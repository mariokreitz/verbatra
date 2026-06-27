import { ProviderError } from "./errors.js";

/** The single static, secret-free message for any failed provider SDK call. */
export const PROVIDER_CALL_FAILED_MESSAGE = "The translation provider request failed.";

/**
 * Run a provider's raw SDK call and, on any throw, discard the caught error and throw a static
 * secret-free {@link ProviderError}, since a raw SDK error can carry an auth header, request data,
 * or a key. Wrap only the raw SDK call; structured errors raised after it propagate unchanged.
 *
 * @param call - A thunk performing exactly the raw SDK call.
 * @returns The call's resolved value, unchanged, on success.
 * @throws {@link ProviderError} `PROVIDER_ERROR`: a static, secret-free error if `call` rejects; the
 *   original error is discarded, never bound or logged.
 */
export async function guardProviderCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new ProviderError("PROVIDER_ERROR", PROVIDER_CALL_FAILED_MESSAGE);
  }
}
