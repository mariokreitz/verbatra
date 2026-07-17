import type { NeedsReviewEntry, RunBudget, UsageSummary } from "../flow/summary.js";

/**
 * One target locale's snapshot inside the persisted run-status file. `status` is carried over from
 * `LocaleSummary.status` unchanged, so an empty `needsReview` on a failed locale is never misread as
 * "this locale ran clean with nothing to review".
 */
export interface RunStatusLocale {
  readonly locale: string;
  readonly status: "succeeded" | "failed";
  /** The full, unmodified list from `LocaleSummary.needsReview`; already bounded and content-free. */
  readonly needsReview: readonly NeedsReviewEntry[];
  /** Absent exactly when the source `LocaleSummary.usage` was absent; never a fabricated zero. */
  readonly usage?: UsageSummary;
}

/**
 * The persisted shape of `.verbatra-local/run-status.json`: one whole-run snapshot, overwritten on
 * every non-dry-run `translate()`/`watch()` run that reaches the end of its per-locale loop. Contains
 * only the review-flag and token/usage data already computed for `RunSummary`; never a translation
 * string, a provider error message, or a provider notice message.
 */
export interface RunStatusFile {
  readonly version: number;
  /** ISO timestamp of when this snapshot was written. */
  readonly generatedAt: string;
  /** Summed run-wide token usage, mirroring `RunSummary.usage`; absent under the same conditions. */
  readonly usage?: UsageSummary;
  /** The run-wide token-budget outcome, mirroring `RunSummary.budget`; present only when configured. */
  readonly budget?: RunBudget;
  readonly locales: readonly RunStatusLocale[];
}
