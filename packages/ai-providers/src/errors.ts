import { redact } from "./redaction.js";

/**
 * Stable, machine-readable codes for provider failures:
 *
 * - `MISSING_API_KEY`: the required environment key is absent.
 * - `INVALID_REQUEST`: the request failed boundary validation (missing extractor or malformed data).
 * - `INVALID_RESPONSE`: provider output was malformed, incomplete, or failed reconciliation.
 * - `OUTPUT_TRUNCATED`: the model hit its output-token limit; remedy is a smaller batch or higher limit.
 * - `PROVIDER_REFUSED`: the model declined to answer.
 * - `PROVIDER_BLOCKED`: the request or response was safety-blocked, filtered, or had no candidate.
 * - `RATE_LIMITED`: the underlying SDK call failed with an HTTP 429 or an equivalent rate-limit error
 *   class; the caller should back off and retry later.
 * - `TIMEOUT`: the underlying SDK call failed with a network or request timeout (no HTTP response was
 *   received in time); the caller may retry.
 * - `AUTH_FAILED`: the underlying SDK call failed with an HTTP 401 or 403; the configured key is invalid,
 *   revoked, or lacks permission. Retrying will not help.
 * - `PROVIDER_ERROR`: an underlying SDK call threw an error the guard could not classify by status code
 *   or SDK error class; mapped to a static, secret-free error.
 */
export type ProviderErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "OUTPUT_TRUNCATED"
  | "PROVIDER_REFUSED"
  | "PROVIDER_BLOCKED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "AUTH_FAILED"
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
    // redact(message, "") passes an empty string so the ANTHROPIC_API_KEY default is not re-applied,
    // keeping this generic error decoupled from one provider's environment variable.
    super(redact(message, ""));
    this.name = "ProviderError";
    this.code = code;
  }
}
