import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { checkPlaceholders } from "@verbatra/core";
import type { PlaceholderExtractor } from "./provider.js";

/** One value to check: its key, the source placeholder set, and the translated text. */
export interface IntegrityInput {
  /** The entry key this result is recorded under. */
  readonly key: string;
  /** The placeholder set from the source value. */
  readonly sourcePlaceholders: readonly string[];
  /** The translated text whose placeholder set is compared against the source. */
  readonly translatedValue: string;
}

/**
 * Run the per-key placeholder-integrity check for a batch. For each value the
 * caller-supplied extractor produces the translated placeholder set, which core's
 * checkPlaceholders compares against the source set. A mismatch is recorded, never
 * thrown and never silently dropped, so a corrupted translation cannot pass as clean.
 *
 * @param inputs - One {@link IntegrityInput} per key.
 * @param extract - The placeholder extractor for the translated value (the request's extractor).
 * @returns A per-key map of placeholder-integrity outcomes; mismatches are recorded, not thrown.
 */
export function checkBatchIntegrity(
  inputs: readonly IntegrityInput[],
  extract: PlaceholderExtractor,
): Map<string, PlaceholderIntegrityResult> {
  const integrity = new Map<string, PlaceholderIntegrityResult>();
  for (const { key, sourcePlaceholders, translatedValue } of inputs) {
    integrity.set(key, checkPlaceholders(sourcePlaceholders, extract(translatedValue)));
  }
  return integrity;
}
