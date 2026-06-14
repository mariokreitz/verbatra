import { type GenerateContentParameters, GoogleGenAI } from "@google/genai";
import { requireGeminiKey } from "../env.js";
import type { GeminiRequest } from "./request.js";
import type { GeminiClient, GeminiResponse } from "./types.js";

/**
 * Build the production client by wrapping the real @google/genai SDK. The SDK type
 * coupling is confined to this one adapter.
 *
 * No log-suppression option is set, by design. Verified from the installed
 * @google/genai 2.8.0 source: the main GoogleGenAI client exposes no logLevel/logger
 * option, and the models.generateContent path has no env-gated request/header/key
 * logging (the logLevel knob belongs to a separate next-gen client we do not use; the
 * only console logging in request code is the unrelated live/websocket API). There is
 * thus no leak path to suppress here, unlike OpenAI/Anthropic. Do NOT "add" a
 * suppression option to fix its apparent absence — there is none on this client.
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
