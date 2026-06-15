import { ProviderError } from "./errors.js";

/** The single static, secret-free message for any failed provider SDK call. */
export const PROVIDER_CALL_FAILED_MESSAGE = "The translation provider request failed.";

/**
 * Run a provider's raw SDK call and, on ANY throw, discard the caught error and throw a
 * static secret-free ProviderError. This is the one place the security invariant lives:
 * a raw SDK/axios error (which can carry an auth header, request data, or a key) is never
 * bound, logged, or re-thrown. Wrap ONLY the raw SDK call; structured errors raised after
 * it (refusal, blocked, invalid-response) are thrown outside the guard and propagate
 * unchanged.
 *
 * @param call - A thunk performing exactly the raw SDK call.
 * @returns The call's resolved value, unchanged, on success.
 * @throws {@link ProviderError} `PROVIDER_ERROR` — a static, secret-free error if `call` rejects; the
 *   original error is discarded, never bound or logged.
 */
export async function guardProviderCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new ProviderError("PROVIDER_ERROR", PROVIDER_CALL_FAILED_MESSAGE);
  }
}
