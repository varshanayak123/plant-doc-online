import { describe, it, expect } from "vitest";
import { isLowConfidence, validateImage, type Prediction } from "./diseaseDetection";

const l = (s: string) => ({ en: s, hi: s, mr: s });
const base: Prediction = {
  crop: l("Tomato"),
  disease: l("Early blight"),
  confidence: 80,
  symptoms: [],
  prevention: [],
  nextStep: l("Ask an expert"),
  conclusive: true,
};

describe("Crop detection rules", () => {
  it("accepts JPG/PNG/WebP up to 10 MB and rejects others", () => {
    expect(validateImage({ type: "image/jpeg", size: 1024 })).toBe(true);
    expect(validateImage({ type: "image/webp", size: 10 * 1024 * 1024 })).toBe(true);
    expect(validateImage({ type: "application/pdf", size: 1024 })).toBe(false);
    expect(validateImage({ type: "image/png", size: 11 * 1024 * 1024 })).toBe(false);
  });
  it("treats confidence below 60% as low confidence", () => {
    expect(isLowConfidence({ ...base, confidence: 59 })).toBe(true);
    expect(isLowConfidence({ ...base, confidence: 60 })).toBe(false);
  });
  it("treats inconclusive AI results as low confidence", () => {
    expect(isLowConfidence({ ...base, conclusive: false })).toBe(true);
  });
});
