import {
  type ClassifiedProviderErrorCode,
  classifyProviderError,
  isAbortError,
} from "./error-classification.js";
import { ProviderError } from "./errors.js";

/** The single static, secret-free message for an unclassified failed provider SDK call. */
export const PROVIDER_CALL_FAILED_MESSAGE = "The translation provider request failed.";
/** Static, secret-free message for a 429 or an equivalent rate-limit error class. */
export const RATE_LIMITED_MESSAGE = "The translation provider rate-limited this request.";
/** Static, secret-free message for a network or request timeout. */
export const TIMEOUT_MESSAGE = "The translation provider request timed out.";
/** Static, secret-free message for a 401 or 403; the configured key is invalid or lacks permission. */
export const AUTH_FAILED_MESSAGE = "The translation provider rejected the request credentials.";

/** The static message for each {@link ClassifiedProviderErrorCode} the guard can produce. */
const MESSAGE_BY_CODE: Readonly<Record<ClassifiedProviderErrorCode, string>> = {
  RATE_LIMITED: RATE_LIMITED_MESSAGE,
  TIMEOUT: TIMEOUT_MESSAGE,
  AUTH_FAILED: AUTH_FAILED_MESSAGE,
  PROVIDER_ERROR: PROVIDER_CALL_FAILED_MESSAGE,
};

/**
 * Run a provider's raw SDK call and, on any throw, discard the caught error and throw a static
 * secret-free {@link ProviderError}, since a raw SDK error can carry an auth header, request data,
 * or a key. Wrap only the raw SDK call; structured errors raised after it propagate unchanged.
 *
 * `signal`, when passed, does two things: if it is already aborted before `call` even runs, the
 * abort is thrown immediately without invoking `call`; and if `call` rejects because the signal
 * fired mid-flight *and* the rejection is itself abort-shaped, the underlying error is re-thrown
 * unchanged instead of being wrapped as a {@link ProviderError}, so a caller can tell "you cancelled
 * this" apart from "the provider failed" (see {@link isAbortError}). An aborted signal alone is not
 * enough: a rejection that merely coincides with the signal firing (an unrelated provider failure
 * racing a caller-initiated cancellation) is still classified and redacted, never passed through raw.
 *
 * @param call - A thunk performing exactly the raw SDK call.
 * @param signal - The caller's cancellation signal, if any, threaded from the request.
 * @returns The call's resolved value, unchanged, on success.
 * @throws The original abort-shaped error, unwrapped, when `signal` was (or became) aborted.
 * @throws {@link ProviderError}: `RATE_LIMITED`, `TIMEOUT`, or `AUTH_FAILED` when the raw error's HTTP
 *   status code or SDK error class matches; `PROVIDER_ERROR` (a static, secret-free fallback)
 *   otherwise. The original error is discarded, never bound or logged.
 */
export async function guardProviderCall<T>(
  call: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  try {
    return await call();
  } catch (error) {
    if (isAbortError(error, signal)) {
      throw error;
    }
    const code = classifyProviderError(error);
    throw new ProviderError(code, MESSAGE_BY_CODE[code]);
  }
}
