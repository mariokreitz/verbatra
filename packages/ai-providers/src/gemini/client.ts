import { GoogleGenAI } from "@google/genai";
import { requireGeminiKey } from "../env.js";
import { toMutableRequest } from "../llm/mutable.js";
import type { GeminiRequest } from "./request.js";
import { withGeminiRetry } from "./retry.js";
import type { GeminiClient, GeminiResponse } from "./types.js";

export function createDefaultClient(): GeminiClient {
  const ai = new GoogleGenAI({ apiKey: requireGeminiKey() });
  return {
    models: {
      generateContent: (request: GeminiRequest): Promise<GeminiResponse> =>
        withGeminiRetry(
          async () =>
            (await ai.models.generateContent(
              toMutableRequest(request),
            )) as unknown as GeminiResponse,
          request.config.abortSignal,
        ),
    },
  };
}
