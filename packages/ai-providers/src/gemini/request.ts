import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import { SHARED_SYSTEM_RULES } from "../llm/system-rules.js";
import type { GeminiConfig } from "./config.js";
import { toGeminiSchema } from "./schema.js";

export const GEMINI_SYSTEM_RULES = [
  ...SHARED_SYSTEM_RULES,
  "Respond only with the structured object: exactly one entry per requested key, no commentary, no extra keys, and no key that was not requested.",
].join("\n");

export interface GeminiRequest {
  readonly model: string;
  readonly contents: readonly [
    { readonly role: "user"; readonly parts: readonly [{ readonly text: string }] },
  ];
  readonly config: {
    readonly systemInstruction: string;
    readonly responseMimeType: "application/json";
    readonly responseSchema: Record<string, unknown>;
    readonly maxOutputTokens: number;
    readonly abortSignal?: AbortSignal;
  };
}

export function buildGeminiRequest(
  config: GeminiConfig,
  payloadJson: string,
  signal?: AbortSignal,
): GeminiRequest {
  return {
    model: config.model,
    contents: [{ role: "user", parts: [{ text: payloadJson }] }],
    config: {
      systemInstruction: GEMINI_SYSTEM_RULES,
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(deriveJsonSchema(translationsResultSchema)),
      maxOutputTokens: config.maxOutputTokens,
      ...(signal !== undefined ? { abortSignal: signal } : {}),
    },
  };
}
