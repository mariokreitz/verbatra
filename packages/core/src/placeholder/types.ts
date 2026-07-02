/**
 * Result of comparing source placeholders against translated-output placeholders as MULTISETS
 * (counts matter). Always returned (never thrown) for an ordinary mismatch.
 */
export interface PlaceholderIntegrityResult {
  /** True when nothing is missing or extra: the multisets match, regardless of order. */
  readonly matches: boolean;
  /** Occurrences present in source but absent from the translation, one per dropped occurrence. Sorted. */
  readonly missing: readonly string[];
  /** Occurrences present in the translation but absent from source, one per surplus occurrence. Sorted. */
  readonly extra: readonly string[];
  /** Same multiset present in both, but in a different order. */
  readonly reordered: boolean;
}
