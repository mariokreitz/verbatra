import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import { SHARED_SYSTEM_RULES } from "../llm/system-rules.js";
import type { GeminiConfig } from "./config.js";
import { toGeminiSchema } from "./schema.js";

/**
 * Compile-time constant: no variable input is ever spliced in (the prompt-injection
 * boundary). All variable input travels in the user-turn contents payload.
 */
export const GEMINI_SYSTEM_RULES = [
  ...SHARED_SYSTEM_RULES,
  "Respond only with the structured object: exactly one entry per requested key, no commentary, no extra keys, and no key that was not requested.",
].join("\n");

/** The generateContent request, narrowed to the fields used here. */
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
    /** Cancellation signal; @google/genai reads this from the request's config, not a call option. */
    readonly abortSignal?: AbortSignal;
  };
}

/**
 * Build the generateContent body from the serialized data payload. The static system
 * rules go in the instruction channel and the user turn carries the JSON payload (the
 * data channel); the responseSchema is transformed from the one canonical derivation.
 *
 * @param signal - Optional cancellation signal, carried in `config.abortSignal` (the shape
 *   @google/genai itself expects it in), never as a separate call argument.
 */
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
