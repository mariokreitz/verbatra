import { type GenerateContentParameters, GoogleGenAI } from "@google/genai";
import { requireGeminiKey } from "../env.js";
import type { GeminiRequest } from "./request.js";
import type { GeminiClient, GeminiResponse } from "./types.js";

/**
 * Build the production client by wrapping the real @google/genai SDK.
 *
 * No log-suppression option is set because this client has no key or header logging
 * path to suppress, unlike OpenAI and Anthropic.
 */
export function createDefaultClient(): GeminiClient {
  const ai = new GoogleGenAI({ apiKey: requireGeminiKey() });
  return {
    models: {
      generateContent: async (request: GeminiRequest): Promise<GeminiResponse> =>
        (await ai.models.generateContent(
          request as unknown as GenerateContentParameters,
        )) as unknown as GeminiResponse,
    },
  };
}
