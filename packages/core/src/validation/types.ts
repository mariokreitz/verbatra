/** A placeholder mismatch, with the integrity details that caused it. */
export interface PlaceholderFinding {
  readonly key: string;
  readonly namespace: string;
  readonly locale: string;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  /**
   * Retained for shape stability, but effectively always false here: a placeholder finding is only
   * emitted on a multiset difference (non-empty missing or extra), and a pure reorder no longer fails
   * integrity, so it is never reported as a finding.
   */
  readonly reordered: boolean;
}
