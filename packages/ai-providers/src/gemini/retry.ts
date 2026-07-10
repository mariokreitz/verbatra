import { getErrorStatus } from "../error-classification.js";

/** Retry tuning for {@link withGeminiRetry}. */
export interface GeminiRetryConfig {
  /** Total attempts including the first; must be at least 1. */
  readonly attempts: number;
  /** Base delay in milliseconds before the first retry; doubles on each subsequent retry. */
  readonly baseDelayMs: number;
}

/**
 * Default retry tuning: 3 total attempts, matching the resilience the openai and
 * @anthropic-ai/sdk clients already get from their default `maxRetries: 2` (2 retries, 3
 * attempts total); 250ms base delay, doubling on each retry.
 */
export const DEFAULT_GEMINI_RETRY: GeminiRetryConfig = { attempts: 3, baseDelayMs: 250 };

/** Whether a raw error is worth retrying: an HTTP 429 or any 5xx. Anything else (including a
 * status-less network error, or an already-aborted call) is left to the caller. */
function isRetryableStatus(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 429 || (status !== undefined && status >= 500 && status < 600);
}

/**
 * Whether `signal` is currently aborted. Wrapped in its own function, rather than inlining
 * `signal?.aborted === true` at each call site, so TypeScript's control-flow narrowing (which
 * treats the readonly `aborted` property as unable to change) does not over-narrow a second check
 * made after an `await` to a compile-time-impossible comparison.
 */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/**
 * Throw an abort-shaped error for `signal`, never the substantive error that triggered the abort
 * check. `signal.throwIfAborted()` throws `signal.reason` (a `DOMException` named `"AbortError"` for
 * a plain `controller.abort()`, or the caller's own reason), which is exactly the native abort shape
 * {@link isAbortError} in `error-classification.ts` recognizes by name. The trailing throw only runs
 * if `signal` were somehow undefined here, which cannot happen given this is only called after
 * {@link isAborted} returned true; it exists so this function is typed `never` without an unsound cast.
 */
function throwAbort(signal: AbortSignal | undefined): never {
  signal?.throwIfAborted();
  throw new DOMException("This operation was aborted.", "AbortError");
}

/** Wait `ms` milliseconds, or return early once `signal` aborts. Never rejects. */
function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Retry a Gemini SDK call with exponential backoff on a transient 429 or 5xx. @google/genai
 * (unlike the openai, @anthropic-ai/sdk, and deepl-node clients this package also wraps) applies
 * no retry at all by default, so a single transient failure would otherwise kill an entire
 * sub-batch. `gemini/client.ts` wraps the SDK's `generateContent` call with this helper.
 *
 * Deliberately does not use @google/genai's own `httpOptions.retryOptions`: when that mechanism
 * exhausts its retries it throws a plain, status-less `Error` instead of the SDK's `ApiError`,
 * which would make the final failure unclassifiable by the shared error classifier beyond its
 * PROVIDER_ERROR fallback. Retrying the raw call directly here means every attempt, including the
 * last, fails with the SDK's real `ApiError` (carrying `.status`), so RATE_LIMITED and AUTH_FAILED
 * still classify correctly even after retries are exhausted.
 *
 * @param call - A thunk performing exactly the raw SDK call, retried as-is on each attempt.
 * @param signal - The caller's cancellation signal, if any; once aborted, a subsequent failed
 *   attempt stops retrying immediately instead of backing off again, and an abort that arrives
 *   while backing off also stops retrying instead of starting another attempt.
 * @param config - Retry tuning; defaults to {@link DEFAULT_GEMINI_RETRY}.
 * @returns The first successful attempt's resolved value.
 * @throws An abort-shaped error (see {@link throwAbort}) when `signal` is or becomes aborted,
 *   whether that happens before an attempt, mid-backoff, or is discovered right after a failed
 *   attempt; never the substantive error that attempt failed with, since a caller further up the
 *   stack (`guardProviderCall`'s `isAbortError`) classifies by the thrown error's own shape, not by
 *   ambient signal state, and needs the abort to actually look like one. Otherwise throws the last
 *   attempt's raw, unclassified error: when every attempt failed or the first non-retryable error
 *   was thrown.
 */
export async function withGeminiRetry<T>(
  call: () => Promise<T>,
  signal?: AbortSignal,
  config: GeminiRetryConfig = DEFAULT_GEMINI_RETRY,
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await call();
    } catch (error) {
      if (isAborted(signal)) {
        throwAbort(signal);
      }
      const exhausted = attempt >= config.attempts;
      if (exhausted || !isRetryableStatus(error)) {
        throw error;
      }
      await delay(config.baseDelayMs * 2 ** (attempt - 1), signal);
      // The delay can resolve early because the signal aborted mid-wait; re-check here instead
      // of relying on `call()` to honor the signal itself, since that behavior is caller-specific.
      if (isAborted(signal)) {
        throwAbort(signal);
      }
      attempt += 1;
    }
  }
}
