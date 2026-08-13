import type { NeedsReviewEntry, RunBudget, UsageSummary } from "../flow/summary.js";

/**
 * One locale's entry in a persisted {@link RunStatusFile}. It is a deliberately narrow projection
 * of {@link LocaleSummary}: only the parts a later session still needs, namely the outcome, the
 * review flags, and the cost.
 */
export interface RunStatusLocale {
  /** The target locale this entry describes. */
  readonly locale: string;
  /** How the locale finished in the recorded run. */
  readonly status: "succeeded" | "partial" | "failed";
  /** Keys the run flagged as worth a human look. */
  readonly needsReview: readonly NeedsReviewEntry[];
  /** Token usage for this locale. Absent when the provider does not report usage. */
  readonly usage?: UsageSummary;
}

/**
 * The snapshot a completed non-dry-run writes to `.verbatra-local/run-status.json`, read back by
 * {@link runStatus}. It lets a tool started after the run, such as a dashboard opened once
 * translation finished, still show what was flagged and what it cost.
 *
 * It is local state, not project state: unlike the lock-file it is not meant to be committed, and
 * losing it costs nothing beyond that history.
 */
export interface RunStatusFile {
  /** The status-file schema version. A file at an unrecognized version is ignored rather than trusted. */
  readonly version: number;
  /** When the run finished, as an ISO 8601 timestamp. */
  readonly generatedAt: string;
  /** Token usage summed across every locale. Absent when the provider does not report usage. */
  readonly usage?: UsageSummary;
  /** The token budget in force during the run, present only when one was configured. */
  readonly budget?: RunBudget;
  /** Per-locale outcomes from the recorded run. */
  readonly locales: readonly RunStatusLocale[];
}
