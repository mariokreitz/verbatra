/**
 * Stable, machine-readable codes for provider failures. Each names a distinct boundary condition:
 *
 * - `MISSING_API_KEY` — the required environment key is absent (raised by the env reader at construction).
 * - `INVALID_REQUEST` — the request failed boundary validation (missing extractor or malformed data).
 * - `INVALID_RESPONSE` — provider output was malformed, incomplete (including a MAX_TOKENS truncation), or
 *   failed reconciliation (extra, duplicate, or missing key; a DeepL positional length mismatch).
 * - `PROVIDER_REFUSED` — the model declined to answer (OpenAI's refusal path only).
 * - `PROVIDER_BLOCKED` — the request or response was safety-blocked, had no candidate, or was filtered
 *   (Gemini's safety paths only).
 * - `PROVIDER_ERROR` — an underlying SDK call threw; mapped to a static, secret-free error by the guard.
 */
export type ProviderErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "PROVIDER_REFUSED"
  | "PROVIDER_BLOCKED"
  | "PROVIDER_ERROR";

/**
 * A structured error for provider boundary failures. It carries only a stable
 * code and a fixed, safe message: it never embeds an API key, raw SDK error
 * text, request headers, or translatable content, so nothing sensitive can leak
 * back through error text.
 */
export class ProviderError extends Error {
  /** The stable {@link ProviderErrorCode} for this failure; branch on this, not the message. */
  readonly code: ProviderErrorCode;

  /**
   * @param code - The stable failure code.
   * @param message - A fixed, safe message; callers must never pass key, SDK, or request-derived text.
   */
  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}
