import type { NeedsReviewEntry, RunBudget, UsageSummary } from "../flow/summary.js";

export interface RunStatusLocale {
  readonly locale: string;
  readonly status: "succeeded" | "partial" | "failed";
  readonly needsReview: readonly NeedsReviewEntry[];
  readonly usage?: UsageSummary;
}

export interface RunStatusFile {
  readonly version: number;
  readonly generatedAt: string;
  readonly usage?: UsageSummary;
  readonly budget?: RunBudget;
  readonly locales: readonly RunStatusLocale[];
}
