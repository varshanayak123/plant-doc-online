import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod/v4";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
const MODEL = "openai/gpt-6-astra";

const localized = z
  .object({ en: z.string(), hi: z.string(), mr: z.string() })
  .strict();

export const analysisSchema = z
  .object({
    is_plant_leaf: z.boolean(),
    conclusive: z.boolean(),
    confidence: z.number().int().min(0).max(100),
    crop: localized,
    disease: localized,
    symptoms: z.array(localized),
    prevention: z.array(localized),
    next_step: localized,
  })
  .strict();

export type LeafAnalysis = z.infer<typeof analysisSchema>;

export class AnalysisError extends Error {
  constructor(public code: "aiUnavailable" | "aiCredits" | "aiRate") {
    super(code);
  }
}

const INSTRUCTIONS = `You are a careful plant pathology screening assistant for farmers in India.
Look at the photo and judge only what is visible. Never invent findings.
- If the image is not a crop/plant leaf, set is_plant_leaf=false, conclusive=false, confidence=0 and use short placeholder text.
- If the leaf looks healthy, set disease to "Healthy (no visible disease)" in each language.
- If the photo is blurry, dark, or symptoms are ambiguous, set conclusive=false and explain in next_step how to retake the photo.
- confidence is your honest 0-100 estimate that the named disease is correct.
- Give 2-4 visible symptoms and 2-4 practical prevention tips. next_step must recommend confirming with a local agricultural expert before treatment.
- Write every text field in English (en), Hindi (hi) and Marathi (mr). Use simple, farmer-friendly language.`;

function statusOf(error: unknown): number | undefined {
  let e: unknown = error;
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    const s = (e as { statusCode?: unknown }).statusCode;
    if (typeof s === "number") return s;
    e = (e as { cause?: unknown; lastError?: unknown }).lastError ?? (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export async function analyzeLeafImage(image: Uint8Array, mediaType: string): Promise<LeafAnalysis> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AnalysisError("aiUnavailable");
  let runId: string | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set(RUN_ID_HEADER, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID_HEADER) ?? undefined;
      return res;
    },
  });
  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Screen this crop leaf photo for disease." },
          { type: "file", data: image, mediaType },
        ],
      },
    ],
    output: Output.object({ schema: analysisSchema }),
    maxRetries: 1,
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    const output = await result.output;
    return analysisSchema.parse(output);
  } catch (error) {
    const status = statusOf(failure ?? error);
    console.error("Leaf analysis failed", status, failure ?? error);
    if (status === 402) throw new AnalysisError("aiCredits");
    if (status === 429) throw new AnalysisError("aiRate");
    throw new AnalysisError("aiUnavailable");
  }
}
