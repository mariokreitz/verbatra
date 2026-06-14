/** Stable, machine-readable codes for provider failures. */
export type ProviderErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "PROVIDER_REFUSED"
  | "PROVIDER_ERROR";

/**
 * A structured error for provider boundary failures. It carries only a stable
 * code and a fixed, safe message: it never embeds an API key, raw SDK error
 * text, request headers, or translatable content, so nothing sensitive can leak
 * back through error text.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}
