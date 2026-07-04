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

/** A secret-free notice for a sub-batch whose provider call failed; carries only a count, never a key. */
export function subBatchFailedNotice(count: number): SdkNotice {
  return {
    code: "SUB_BATCH_FAILED",
    message: `A sub-batch of ${count} entries failed and was withheld; it will be retried next run.`,
  };
}
