import { ProviderError } from "@verbatra/ai-providers";
import type { SdkNotice } from "./summary.js";

/**
 * Split a list into consecutive chunks of at most `size`, preserving order. `size` is a positive
 * integer, guaranteed by the config schema. Shared by every flow stage that must bound a single
 * provider request (main translation and plural-form generation alike).
 */
export function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** The static, secret-free fallback for a caught value that is not a {@link ProviderError}. */
const GENERIC_PROVIDER_FAILURE_MESSAGE = "The provider call failed.";

/**
 * Classify a caught provider-call failure into a secret-free code and message. Only a genuine
 * {@link ProviderError} is safe to surface verbatim: its contract guarantees its message is already
 * redacted. Any other thrown value (for example a raw SDK exception that slipped past a provider's
 * guard) may carry request data or a key, so it is replaced with a static, generic fallback instead of
 * being inspected.
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
 * A secret-free notice for a sub-batch whose provider call failed. Carries the entry count and, for a
 * genuine {@link ProviderError}, its code and message. Shared by every flow stage that isolates a
 * per-sub-batch provider failure (main translation and plural-form generation alike).
 */
export function subBatchFailedNotice(count: number, error: unknown): SdkNotice {
  const { code, message } = classifyProviderFailure(error);
  return {
    code: "SUB_BATCH_FAILED",
    message: `A sub-batch of ${count} entries failed (${code}: ${message}) and was withheld; it will be retried next run.`,
  };
}
