import type { ProviderNotice, ReviewReasonCode } from "@verbatra/ai-providers";

export type SdkNoticeCode =
  | "PLURAL_CATEGORIES_INCOMPLETE"
  | "SUB_BATCH_FAILED"
  | "BLANK_ROW_BASELINE_RETAINED"
  | "BUDGET_TOKENS_EXCEEDED"
  | "CACHE_VERSION_UNRECOGNIZED";

export interface UsageSummary {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type BudgetBehavior = "warn" | "stop";

export interface RunBudget {
  readonly maxTokens: number;
  readonly behavior: BudgetBehavior;
  readonly supported: boolean;
  readonly tokensUsed: number;
  readonly exceeded: boolean;
}

export interface SdkNotice {
  readonly code: SdkNoticeCode;
  readonly message: string;
}

export type LocaleNotice = ProviderNotice | SdkNotice;

export interface NeedsReviewEntry {
  readonly key: string;
  readonly reasons: readonly ReviewReasonCode[];
}

export interface MalformedRowReport {
  readonly row: number;
  readonly line?: number;
  readonly column: string;
}

export interface DuplicateKeyReport {
  readonly key: string;
  readonly row: number;
  readonly line?: number;
}

export interface LocaleSummary {
  readonly locale: string;
  readonly status: "succeeded" | "partial" | "failed";
  readonly translated: readonly string[];
  readonly unchanged: readonly string[];
  readonly orphaned: readonly string[];
  readonly pruned: readonly string[];
  readonly invalidIcuSource: readonly string[];
  readonly cacheHits: readonly string[];
  readonly integrityMismatches: readonly string[];
  readonly providerFailures: readonly string[];
  readonly generated: readonly string[];
  readonly budgetWithheld: readonly string[];
  readonly usage?: UsageSummary;
  readonly notices: readonly LocaleNotice[];
  readonly needsReview: readonly NeedsReviewEntry[];
  readonly unfilled: readonly string[];
  readonly malformedRows: readonly MalformedRowReport[];
  readonly duplicateKeys: readonly DuplicateKeyReport[];
  readonly error?: { readonly code: string; readonly message: string };
}

export interface RunSummary {
  readonly dryRun: boolean;
  readonly locales: readonly LocaleSummary[];
  readonly succeeded: readonly string[];
  readonly partial: readonly string[];
  readonly failed: readonly string[];
  readonly usage?: UsageSummary;
  readonly budget?: RunBudget;
}
