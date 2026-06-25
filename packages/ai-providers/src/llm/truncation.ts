import { ProviderError } from "../errors.js";

/**
 * The single, fixed, secret-free message for an output-token truncation, shared by every LLM provider so
 * the wording is identical across OpenAI, Anthropic, and Gemini. It names the actionable remedy and carries
 * no key, raw SDK text, header, or translatable content.
 */
export const OUTPUT_TRUNCATED_MESSAGE =
  "The provider stopped because the output-token limit was reached. " +
  "Reduce the batch size or raise the configured max output tokens.";

/**
 * Throw the shared, secret-free truncation {@link ProviderError} when the model stopped on the output-token
 * limit. Each provider passes the boolean it derives from its own stop signal (OpenAI
 * `finish_reason === "length"`, Anthropic `stop_reason === "max_tokens"`, Gemini `MAX_TOKENS`). This runs
 * before any result parsing or reconciliation, so a truncated-but-valid JSON body is still reported as
 * truncation rather than a key mismatch.
 *
 * @param truncated - Whether the response stopped because the output-token limit was hit.
 * @throws {@link ProviderError} `OUTPUT_TRUNCATED`: when `truncated` is true.
 */
export function assertNotTruncated(truncated: boolean): void {
  if (truncated) {
    throw new ProviderError("OUTPUT_TRUNCATED", OUTPUT_TRUNCATED_MESSAGE);
  }
}
