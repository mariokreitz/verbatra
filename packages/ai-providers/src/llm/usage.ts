import type { Usage } from "../provider.js";

/**
 * Build a {@link Usage} from a provider's two raw token counts, or `undefined` when either is
 * missing or not a number. Each provider calls this with its own field names already destructured
 * (Anthropic's `input_tokens`/`output_tokens`, OpenAI's `prompt_tokens`/`completion_tokens`,
 * Gemini's `promptTokenCount`/`candidatesTokenCount`), so the guard shape stays in one place.
 */
export function toUsage(
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): Usage | undefined {
  if (typeof inputTokens !== "number" || typeof outputTokens !== "number") {
    return undefined;
  }
  return { inputTokens, outputTokens };
}
