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

/** Wait `ms` milliseconds, or return early once `signal` aborts. Never rejects. */
function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
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
 *   attempt stops retrying immediately instead of backing off again.
 * @param config - Retry tuning; defaults to {@link DEFAULT_GEMINI_RETRY}.
 * @returns The first successful attempt's resolved value.
 * @throws The last attempt's raw, unclassified error: when every attempt failed, or the first
 *   non-retryable error was thrown.
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
      const exhausted = attempt >= config.attempts;
      if (exhausted || signal?.aborted === true || !isRetryableStatus(error)) {
        throw error;
      }
      await delay(config.baseDelayMs * 2 ** (attempt - 1), signal);
      attempt += 1;
    }
  }
}
