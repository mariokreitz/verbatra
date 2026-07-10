import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { checkPlaceholders } from "@verbatra/core";
import type { PlaceholderComparator, PlaceholderExtractor } from "./provider.js";

/** One value to check: its key, the source value, and the translated text. */
export interface IntegrityInput {
  /** The entry key this result is recorded under. */
  readonly key: string;
  /** The source value the translation is checked against. */
  readonly sourceValue: string;
  /** The translated text whose placeholder set is compared against the source. */
  readonly translatedValue: string;
}

/**
 * Run the per-key placeholder-integrity check for a batch. A mismatch is recorded, never thrown
 * and never silently dropped, so a corrupted translation cannot pass as clean.
 *
 * @param inputs - One {@link IntegrityInput} per key.
 * @param extract - The placeholder extractor for the translated value (the request's extractor).
 * @param compare - Optional branch-aware comparator (the request's `comparePlaceholders`). When present,
 *   it runs directly on the source and translated values instead of `extract` plus `checkPlaceholders`.
 * @returns A per-key map of placeholder-integrity outcomes; mismatches are recorded, not thrown.
 */
export function checkBatchIntegrity(
  inputs: readonly IntegrityInput[],
  extract: PlaceholderExtractor,
  compare?: PlaceholderComparator,
): Map<string, PlaceholderIntegrityResult> {
  const integrity = new Map<string, PlaceholderIntegrityResult>();
  for (const { key, sourceValue, translatedValue } of inputs) {
    integrity.set(
      key,
      compare !== undefined
        ? compare(sourceValue, translatedValue)
        : checkPlaceholders(extract(sourceValue), extract(translatedValue)),
    );
  }
  return integrity;
}
