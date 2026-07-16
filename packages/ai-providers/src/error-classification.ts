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
 *
 * `RateLimitError` comes from openai and @anthropic-ai/sdk; `TooManyRequestsError` from deepl-node.
 */
const RATE_LIMITED_CLASS_NAMES: ReadonlySet<string> = new Set([
  "RateLimitError",
  "TooManyRequestsError",
]);
/**
 * Auth-failure class names: `AuthenticationError` (openai, @anthropic-ai/sdk, 401),
 * `PermissionDeniedError` (openai, @anthropic-ai/sdk, 403), and `AuthorizationError` (deepl-node).
 */
const AUTH_FAILED_CLASS_NAMES: ReadonlySet<string> = new Set([
  "AuthenticationError",
  "PermissionDeniedError",
  "AuthorizationError",
]);
/**
 * Timeout class names: `APIConnectionTimeoutError` (openai, @anthropic-ai/sdk) and `ConnectionError`
 * (deepl-node). deepl-node has no distinct timeout class; `ConnectionError` is its only
 * network-failure class, so it is folded into TIMEOUT rather than the PROVIDER_ERROR fallback.
 */
const TIMEOUT_CLASS_NAMES: ReadonlySet<string> = new Set([
  "APIConnectionTimeoutError",
  "ConnectionError",
]);

/**
 * SDK error class names that indicate a caller-initiated abort, matched via `error.constructor.name`
 * rather than `error.name`: openai's and @anthropic-ai/sdk's `APIUserAbortError` never sets
 * `this.name`, so `.name` on an instance is the inherited `"Error"`, not `"AbortError"`. Gemini
 * (@google/genai) threads the signal into Node's native `fetch`, which rejects with a `DOMException`
 * named `"AbortError"` on abort; that is covered separately, by name, in {@link isAbortError}.
 *
 * deepl-node accepts no cancellation signal at all and has no abort-shaped error class of its own
 * (see its `errors.d.ts`: `AuthorizationError`, `ConnectionError`, etc., none abort-related), so it is
 * deliberately absent here. A DeepL failure can therefore never match this set or the native
 * `"AbortError"` name, and always falls through to classification, even while a shared signal happens
 * to be aborted concurrently.
 */
const ABORT_ERROR_CLASS_NAMES: ReadonlySet<string> = new Set(["APIUserAbortError"]);

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
 * Whether `error` itself is shaped like an abort: either a native `AbortError` (the `DOMException`
 * Node's `fetch`, and `AbortSignal.throwIfAborted`, produce; this is what Gemini surfaces, since its
 * signal rides into native `fetch`), or one of {@link ABORT_ERROR_CLASS_NAMES} (openai's and
 * @anthropic-ai/sdk's `APIUserAbortError`, matched by class identity because its `.name` is not set).
 * Never true for a plain `Error` or an SDK error class outside that set, regardless of its message.
 */
function isAbortShapedError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  const className = readClassName(error);
  return className !== undefined && ABORT_ERROR_CLASS_NAMES.has(className);
}

/**
 * Whether a raw provider SDK error represents a caller-initiated cancellation rather than a
 * provider failure. This correlates the caught error's own identity with the abort instead of
 * trusting ambient state: ambient `signal.aborted` alone is not proof that `error` was *caused* by
 * that abort, since any unrelated error can throw at the same moment a shared signal happens to fire
 * (a batch orchestrator cancelling a shared `AbortController` after a sibling call fails, for
 * example). Trusting `signal.aborted` alone would let that unrelated error's raw, unredacted SDK
 * error (which can carry a header or key) bypass `classifyProviderError` and {@link ProviderError}
 * entirely via {@link guardProviderCall}'s passthrough.
 *
 * When `signal` is provided, both conditions must hold: the signal is actually aborted, and `error`
 * matches a known abort shape (see {@link isAbortShapedError}). When no `signal` is available at all
 * (a caller that aborts without threading one through), the shape check alone decides, since there is
 * no ambient state to correlate against. Either way, an error that does not match a known abort shape
 * is never treated as an abort, so it always falls through to classification and redaction; the
 * default when in doubt is secrecy, not passthrough.
 *
 * @param error - The raw value caught from an SDK call.
 * @param signal - The signal, if any, the call was made with.
 * @returns True when `error` should be re-thrown as an abort instead of a {@link ProviderError}.
 */
export function isAbortError(error: unknown, signal: AbortSignal | undefined): boolean {
  if (signal !== undefined) {
    return signal.aborted === true && isAbortShapedError(error);
  }
  return isAbortShapedError(error);
}
