import { ProviderError } from "@verbatra/ai-providers";
import type { SdkNotice } from "./summary.js";

/**
 * Splits a list into consecutive chunks of at most `size`, preserving order. Shared by every flow
 * stage that must bound a single provider request (main translation and plural-form generation
 * alike). `size` must be a positive integer; the config schema guarantees this for flow callers.
 *
 * @param items - The list to split.
 * @param size - The maximum length of each chunk.
 */
export function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** The static, secret-free fallback message for a caught value that is not a {@link ProviderError}. */
const GENERIC_PROVIDER_FAILURE_MESSAGE = "The provider call failed.";

/**
 * Classifies a caught provider-call failure into a secret-free code and message. Only a genuine
 * {@link ProviderError} is surfaced verbatim: its contract guarantees the message is already
 * redacted. Any other thrown value (for example a raw SDK exception that slipped past a provider's
 * guard) may carry request data or a key, so it is replaced with a static, generic fallback instead
 * of being inspected.
 */
function classifyProviderFailure(error: unknown): {
  readonly code: string;
  readonly message: string;
} {
  if (error instanceof ProviderError) {
    return { code: error.code, message: error.message };
  }
  return { code: "PROVIDER_CALL_FAILED", message: GENERIC_PROVIDER_FAILURE_MESSAGE };
}

/**
 * Builds the secret-free `SUB_BATCH_FAILED` notice for a sub-batch whose provider call failed. The
 * message carries the entry count and, for a genuine {@link ProviderError}, its code and message;
 * any other thrown value is reported with a generic fallback. Shared by every flow stage that
 * isolates a per-sub-batch provider failure (main translation and plural-form generation alike).
 *
 * @param count - How many entries the failed sub-batch carried.
 * @param error - The value the provider call threw.
 */
export function subBatchFailedNotice(count: number, error: unknown): SdkNotice {
  const { code, message } = classifyProviderFailure(error);
  return {
    code: "SUB_BATCH_FAILED",
    message: `A sub-batch of ${count} entries failed (${code}: ${message}) and was withheld; it will be retried next run.`,
  };
}
