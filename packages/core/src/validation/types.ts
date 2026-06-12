/** Locates an entry so a consumer can find the problem it describes. */
export interface ValidationFinding {
  readonly key: string;
  readonly namespace: string;
  readonly locale: string;
}

/** A placeholder mismatch, with the integrity details that caused it. */
export interface PlaceholderFinding extends ValidationFinding {
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly reordered: boolean;
}

/**
 * Aggregated problems for one target relative to its source. isValid is true only
 * when all three finding lists are empty. Lists are sorted by key.
 */
export interface ValidationReport {
  readonly isValid: boolean;
  readonly missingKeys: readonly ValidationFinding[];
  readonly brokenPlaceholders: readonly PlaceholderFinding[];
  readonly invalidIcu: readonly ValidationFinding[];
}

export interface ValidateOptions {
  /**
   * Target keys flagged as invalid ICU, determined outside core. core aggregates
   * these into the report; it does not parse ICU itself.
   */
  readonly invalidIcuKeys?: readonly string[];
}
