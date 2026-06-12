/**
 * Result of comparing a source placeholder set against a translated-output
 * placeholder set. Always returned (never thrown) for an ordinary mismatch.
 */
export interface PlaceholderIntegrityResult {
  /** True when nothing is missing or extra and order is preserved. */
  readonly matches: boolean;
  /** In source, absent from the translation. Sorted. */
  readonly missing: readonly string[];
  /** In the translation, absent from source. Sorted. */
  readonly extra: readonly string[];
  /** Same set present in both, but in a different order. */
  readonly reordered: boolean;
}
