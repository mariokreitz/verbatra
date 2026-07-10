import type { ProviderErrorCode } from "./errors.js";

/**
 * The subset of {@link ProviderErrorCode} {@link classifyProviderError} can produce. Narrower than
 * the full code union (which also carries codes raised elsewhere, like `MISSING_API_KEY` and
 * `INVALID_REQUEST`) so a caller indexing a per-code message table by this return type does not
 * need to handle codes this classifier never returns.
 */
export type ClassifiedProviderErrorCode = Extract<
  ProviderErrorCode,
  "RATE_LIMITED" | "TIMEOUT" | "AUTH_FAILED" | "PROVIDER_ERROR"
>;

/** HTTP status codes recognized by {@link classifyProviderError}. */
const RATE_LIMITED_STATUS = 429;
const TIMEOUT_STATUS = 408;
const AUTH_FAILED_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/**
 * SDK error class names recognized by {@link classifyProviderError}, matched via
 * `error.constructor.name` rather than an `instanceof` import. This keeps the shared
 * classifier decoupled from the four SDKs (openai, @anthropic-ai/sdk, @google/genai,
 * deepl-node) while still classifying by class identity, never by message text.
 */
const RATE_LIMITED_CLASS_NAMES: ReadonlySet<string> = new Set([
  "RateLimitError", // openai, @anthropic-ai/sdk
  "TooManyRequestsError", // deepl-node
]);
const AUTH_FAILED_CLASS_NAMES: ReadonlySet<string> = new Set([
  "AuthenticationError", // openai, @anthropic-ai/sdk (401)
  "PermissionDeniedError", // openai, @anthropic-ai/sdk (403)
  "AuthorizationError", // deepl-node
]);
const TIMEOUT_CLASS_NAMES: ReadonlySet<string> = new Set([
  "APIConnectionTimeoutError", // openai, @anthropic-ai/sdk
  // deepl-node has no distinct timeout class; ConnectionError is its only network-failure
  // class, so it is folded into TIMEOUT rather than the PROVIDER_ERROR fallback.
  "ConnectionError",
]);

/**
 * Read a numeric `status` property off an unknown thrown value, or undefined if absent. Exported
 * so a provider's own retry-eligibility check (for example Gemini's, which needs to decide whether
 * a failed attempt is worth retrying before this module's classification runs) can reuse the same
 * status extraction instead of duplicating it.
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  const status = (error as { readonly status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/** Read the thrown value's constructor name, or undefined if it is not a class instance. */
function readClassName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  return error.constructor?.name;
}

/**
 * Classify a raw provider SDK error into a stable {@link ProviderErrorCode}, using only its HTTP
 * status code or its SDK error class identity, never its message text (message text can carry
 * provider-specific details and is unstable across SDK versions). Recognizes RATE_LIMITED (429),
 * AUTH_FAILED (401, 403), and TIMEOUT (408, or a connection/timeout error class with no status)
 * across the four v1 provider SDKs; anything else falls back to PROVIDER_ERROR.
 *
 * @param error - The raw value caught from an SDK call; never inspected beyond status/class identity.
 * @returns The best-matching {@link ProviderErrorCode}; `PROVIDER_ERROR` when nothing matches.
 */
export function classifyProviderError(error: unknown): ClassifiedProviderErrorCode {
  const status = getErrorStatus(error);
  if (status === RATE_LIMITED_STATUS) {
    return "RATE_LIMITED";
  }
  if (status !== undefined && AUTH_FAILED_STATUSES.has(status)) {
    return "AUTH_FAILED";
  }
  if (status === TIMEOUT_STATUS) {
    return "TIMEOUT";
  }

  const className = readClassName(error);
  if (className !== undefined) {
    if (RATE_LIMITED_CLASS_NAMES.has(className)) {
      return "RATE_LIMITED";
    }
    if (AUTH_FAILED_CLASS_NAMES.has(className)) {
      return "AUTH_FAILED";
    }
    if (TIMEOUT_CLASS_NAMES.has(className)) {
      return "TIMEOUT";
    }
  }
  return "PROVIDER_ERROR";
}

/**
 * Whether a raw provider SDK error represents a caller-initiated cancellation rather than a
 * provider failure. The signal's own `aborted` flag is authoritative and covers all four provider
 * SDKs uniformly (each surfaces a differently-shaped error on abort); a native `AbortError` name is
 * also recognized as a fallback for a caller that aborts without passing `signal` through.
 *
 * @param error - The raw value caught from an SDK call.
 * @param signal - The signal, if any, the call was made with.
 * @returns True when `error` should be re-thrown as an abort instead of a {@link ProviderError}.
 */
export function isAbortError(error: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted === true) {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}
