/**
 * Classification of a target's keys relative to a source. Every array is sorted
 * for deterministic output. Keys are partitioned: a key appears in exactly one of
 * missing, orphaned, changed, or unchanged.
 */
export interface DiffResult {
  /** Present in source, absent in target. */
  readonly missing: readonly string[];
  /** Present in both, but source content changed since the target was produced. */
  readonly changed: readonly string[];
  /** Present in target, absent in source. */
  readonly orphaned: readonly string[];
  /** Present in both and not detected as changed. */
  readonly unchanged: readonly string[];
}

export interface DiffOptions {
  /**
   * Map of key to the source content hash the target was last produced from.
   * Required to detect changed/stale keys; without it, shared keys are unchanged.
   */
  readonly baseline?: ReadonlyMap<string, string>;
}
