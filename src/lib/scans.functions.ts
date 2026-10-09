import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.string().regex(/^[a-f0-9]{64}$/);
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

async function guestKey(guestToken: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(guestToken));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type ScanError =
  | "invalidFile"
  | "uploadFailed"
  | "aiUnavailable"
  | "aiCredits"
  | "aiRate"
  | "notLeaf"
  | "saveFailed";

export const uploadLeaf = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ guestToken: token, image: z.string().max(15_000_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data.image);
    if (!match || !TYPES.includes(match[1])) return { ok: false as const, error: "invalidFile" as ScanError };
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (!bytes.length || bytes.length > MAX_BYTES) return { ok: false as const, error: "invalidFile" as ScanError };
    const key = await guestKey(data.guestToken);
    const ext = match[1].split("/")[1];
    const path = `${key}/${crypto.randomUUID()}.${ext}`;
    const db = await admin();
    const { error } = await db.storage.from("crop-images").upload(path, bytes, { contentType: match[1] });
    if (error) {
      console.error("upload failed", error);
      return { ok: false as const, error: "uploadFailed" as ScanError };
    }
    return { ok: true as const, path };
  });

export const analyzeLeaf = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ guestToken: token, path: z.string().max(200), fileName: z.string().max(200) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = await guestKey(data.guestToken);
    if (!data.path.startsWith(`${key}/`) || data.path.includes(".."))
      return { ok: false as const, error: "uploadFailed" as ScanError };
    const db = await admin();
    const file = await db.storage.from("crop-images").download(data.path);
    if (file.error || !file.data) return { ok: false as const, error: "uploadFailed" as ScanError };
    const { analyzeLeafImage, AnalysisError } = await import("./leaf-analysis.server");
    let a;
    try {
      a = await analyzeLeafImage(new Uint8Array(await file.data.arrayBuffer()), file.data.type || "image/jpeg");
    } catch (e) {
      return { ok: false as const, error: (e instanceof AnalysisError ? e.code : "aiUnavailable") as ScanError };
    }
    if (!a.is_plant_leaf) {
      await db.storage.from("crop-images").remove([data.path]);
      return { ok: false as const, error: "notLeaf" as ScanError };
    }
    const row = {
      guest_key: key,
      image_path: data.path,
      file_name: data.fileName,
      crop_name: a.crop,
      disease_name: a.disease,
      confidence: a.confidence,
      symptoms: a.symptoms,
      prevention_tips: a.prevention,
      next_step: a.next_step,
      is_conclusive: a.conclusive,
    };
    const prediction = {
      crop: a.crop,
      disease: a.disease,
      confidence: a.confidence,
      symptoms: a.symptoms,
      prevention: a.prevention,
      nextStep: a.next_step,
      conclusive: a.conclusive,
    };
    const { error } = await db.from("scan_history").insert(row);
    if (error) console.error("save failed", error);
    return { ok: true as const, prediction, saved: !error };
  });

export const listScans = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ guestToken: token }).parse(d))
  .handler(async ({ data }) => {
    const key = await guestKey(data.guestToken);
    const db = await admin();
    const { data: rows, error } = await db
      .from("scan_history")
      .select("*")
      .eq("guest_key", key)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load history");
    const urls = rows.length
      ? (await db.storage.from("crop-images").createSignedUrls(rows.map((r) => r.image_path), 3600)).data ?? []
      : [];
    return rows.map((r, i) => ({
      id: r.id,
      createdAt: r.created_at,
      fileName: r.file_name,
      imageUrl: urls[i]?.signedUrl ?? "",
      prediction: {
        crop: r.crop_name,
        disease: r.disease_name,
        confidence: r.confidence,
        symptoms: r.symptoms,
        prevention: r.prevention_tips,
        nextStep: r.next_step,
        conclusive: r.is_conclusive,
      },
    }));
  });

export const clearScans = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ guestToken: token }).parse(d))
  .handler(async ({ data }) => {
    const key = await guestKey(data.guestToken);
    const db = await admin();
    const { data: rows } = await db.from("scan_history").select("image_path").eq("guest_key", key);
    if (rows?.length) await db.storage.from("crop-images").remove(rows.map((r) => r.image_path));
    const { error } = await db.from("scan_history").delete().eq("guest_key", key);
    if (error) throw new Error("Could not clear history");
    return { ok: true };
  });
