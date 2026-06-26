import { redact } from "./redaction.js";

/**
 * Stable, machine-readable codes for provider failures. Each names a distinct boundary condition:
 *
 * - `MISSING_API_KEY`: the required environment key is absent (raised by the env reader at construction).
 * - `INVALID_REQUEST`: the request failed boundary validation (missing extractor or malformed data).
 * - `INVALID_RESPONSE`: provider output was malformed, incomplete, or failed reconciliation (extra,
 *   duplicate, or missing key; a DeepL positional length mismatch).
 * - `OUTPUT_TRUNCATED`: the model stopped because it hit the output-token limit (OpenAI
 *   `finish_reason === "length"`, Anthropic `stop_reason === "max_tokens"`, Gemini `MAX_TOKENS`); the
 *   remedy is a smaller batch or a higher max output tokens. Checked before result parsing, so a
 *   truncated-but-valid JSON body is still reported as truncation, not reconciliation failure.
 * - `PROVIDER_REFUSED`: the model declined to answer (OpenAI's refusal path only).
 * - `PROVIDER_BLOCKED`: the request or response was safety-blocked, had no candidate, or was filtered
 *   (Gemini's safety paths only).
 * - `PROVIDER_ERROR`: an underlying SDK call threw; mapped to a static, secret-free error by the guard.
 */
export type ProviderErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "OUTPUT_TRUNCATED"
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
   * @param message - A fixed, safe message; callers must never pass key, SDK, or request-derived
   *   text. By-construction safety is the guarantee; the {@link redact} call below is a
   *   defense-in-depth backstop, not a license to pass dynamic text.
   */
  constructor(code: ProviderErrorCode, message: string) {
    // Pattern-scrub every message as a backstop. Pass "" explicitly so the `ANTHROPIC_API_KEY`
    // default is not re-applied (JS re-applies a default only on `undefined`; "" is falsy and
    // selects pattern-only scrubbing): a generic four-provider error must not couple to one
    // provider's environment variable.
    super(redact(message, ""));
    this.name = "ProviderError";
    this.code = code;
  }
}
