import type { Prediction } from "./diseaseDetection";
import { clearScans, listScans } from "@/lib/scans.functions";

export type Scan = {
  id: string;
  createdAt: string;
  imageUrl: string;
  fileName: string;
  prediction: Prediction;
};
const TOKEN_KEY = "agrovision-guest-token";

/** Private, random guest token identifying this browser's scans. */
export function getGuestToken() {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export async function readHistory(): Promise<Scan[]> {
  return (await listScans({ data: { guestToken: getGuestToken() } })) as Scan[];
}

export async function clearHistory() {
  await clearScans({ data: { guestToken: getGuestToken() } });
}

export function createThumbnail(source: string, size = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, size / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => reject(new Error("Invalid image"));
    image.src = source;
  });
}
