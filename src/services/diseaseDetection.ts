import type { Language } from "@/lib/i18n";
import { analyzeLeaf, uploadLeaf, type ScanError } from "@/lib/scans.functions";

export type Localized = Record<Language, string>;
export type Prediction = {
  crop: Localized;
  disease: Localized;
  confidence: number;
  symptoms: Localized[];
  prevention: Localized[];
  nextStep: Localized;
  conclusive: boolean;
};
export type { ScanError };
export const LOW_CONFIDENCE_THRESHOLD = 60;

export function isLowConfidence(prediction: Prediction) {
  return !prediction.conclusive || prediction.confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function validateImage(file: Pick<File, "type" | "size">) {
  return (
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size > 0 &&
    file.size <= 10 * 1024 * 1024
  );
}

/** Uploads a prepared image (data URL) to private storage. */
export async function uploadImage(guestToken: string, image: string) {
  return uploadLeaf({ data: { guestToken, image } });
}

/** Sends an uploaded image to the real AI screening service. */
export async function analyzeImage(guestToken: string, path: string, fileName: string) {
  return analyzeLeaf({ data: { guestToken, path, fileName } });
}
