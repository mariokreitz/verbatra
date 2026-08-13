import {
  type ClassifiedProviderErrorCode,
  classifyProviderError,
  isAbortError,
} from "./error-classification.js";
import { ProviderError } from "./errors.js";

export const PROVIDER_CALL_FAILED_MESSAGE = "The translation provider request failed.";
export const RATE_LIMITED_MESSAGE = "The translation provider rate-limited this request.";
export const TIMEOUT_MESSAGE = "The translation provider request timed out.";
export const AUTH_FAILED_MESSAGE = "The translation provider rejected the request credentials.";
export const PROVIDER_UNAVAILABLE_MESSAGE = "The translation provider is currently unavailable.";

const MESSAGE_BY_CODE: Readonly<Record<ClassifiedProviderErrorCode, string>> = {
  RATE_LIMITED: RATE_LIMITED_MESSAGE,
  TIMEOUT: TIMEOUT_MESSAGE,
  AUTH_FAILED: AUTH_FAILED_MESSAGE,
  PROVIDER_UNAVAILABLE: PROVIDER_UNAVAILABLE_MESSAGE,
  PROVIDER_ERROR: PROVIDER_CALL_FAILED_MESSAGE,
};

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
