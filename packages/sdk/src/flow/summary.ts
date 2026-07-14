import type { ProviderNotice, ReviewReasonCode } from "@verbatra/ai-providers";

/** A stable code for an SDK-originated notice (not a provider notice). */
export type SdkNoticeCode =
  | "PLURAL_CATEGORIES_INCOMPLETE"
  | "SUB_BATCH_FAILED"
  | "BLANK_ROW_BASELINE_RETAINED"
  | "BUDGET_TOKENS_EXCEEDED";

/** Summed token usage across every provider call in a scope (one locale, or the whole run). */
export interface UsageSummary {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** The configured token-budget behavior: warn and continue, or stop making further provider calls. */
export type BudgetBehavior = "warn" | "stop";

/**
 * The run-wide token-budget outcome, present on {@link RunSummary} only when `maxTokens` is configured.
 * `supported: false` means the configured provider never reported usage in this run (a token-less
 * provider such as DeepL, or a dry-run): the guardrail is honestly inert, `tokensUsed` stays `0`, and
 * `exceeded` stays `false`, never a false trip.
 */
export interface RunBudget {
  /** The configured ceiling. */
  readonly maxTokens: number;
  /** The configured behavior once the ceiling is reached. */
  readonly behavior: BudgetBehavior;
  /** Whether the configured provider reported usage at all this run. */
  readonly supported: boolean;
  /** Cumulative input plus output tokens across the run so far. */
  readonly tokensUsed: number;
  /** Whether `tokensUsed` reached or passed `maxTokens` at any point this run. */
  readonly exceeded: boolean;
}

/**
 * A notice raised by the SDK itself (not a provider), structurally identical to a {@link ProviderNotice}
 * so both share the {@link LocaleSummary.notices} channel. Carries only a stable code and a static,
 * secret-free message; never a key value or translatable content.
 */
export interface SdkNotice {
  /** The stable {@link SdkNoticeCode} for what the SDK is reporting. */
  readonly code: SdkNoticeCode;
  /** A static, safe description; never a key or translatable content. */
  readonly message: string;
}

/** A notice on a locale summary: either a provider-emitted notice or an SDK-emitted one. */
export type LocaleNotice = ProviderNotice | SdkNotice;

/** One key flagged for human review, and every reason code that applies to it. */
export interface NeedsReviewEntry {
  /** The flagged key. */
  readonly key: string;
  /** Every {@link ReviewReasonCode} that applies to this key. */
  readonly reasons: readonly ReviewReasonCode[];
}

/** Structured outcome for one target locale; surfaced as data on the run, never thrown. */
export interface LocaleSummary {
  /** The target locale this summary is for. */
  readonly locale: string;
  /** Whether this locale's run succeeded or failed (a failure does not abort the run). */
  readonly status: "succeeded" | "failed";
  /**
   * Keys translated and written this run. In dry-run, the keys that WOULD be translated
   * (the provider is not called and nothing is written).
   */
  readonly translated: readonly string[];
  /** Keys already up to date, left unchanged this run. */
  readonly unchanged: readonly string[];
  /** Target keys with no corresponding source key (candidates for removal). Reported regardless of pruning. */
  readonly orphaned: readonly string[];
  /**
   * Orphaned keys actually removed this run because pruning was on. In a dry-run with pruning on, the keys
   * that WOULD be removed. Empty when pruning is off (the orphans then survive and are reported in
   * `orphaned` only). A subset of `orphaned`; never includes a source-present key.
   */
  readonly pruned: readonly string[];
  /** Source keys flagged invalid-ICU that were skipped for translation this run. */
  readonly invalidIcuSource: readonly string[];
  /**
   * Translated keys that failed the placeholder-integrity check and were withheld. Never includes a
   * key withheld because the provider call itself failed; see {@link LocaleSummary.providerFailures}
   * for that case.
   */
  readonly integrityMismatches: readonly string[];
  /**
   * Keys withheld because nothing was translated for them this run, as distinct from a translation
   * that came back and failed the placeholder-integrity check. This covers two causes: the provider
   * call itself failed (for example a revoked API key, a rate limit, or a network timeout), in which
   * case the corresponding {@link LocaleSummary.notices} entry carries the secret-free failure code
   * and message; or the call succeeded but the key was still missing or duplicated in the response
   * after the shared LLM layer's bounded reconcile repair round, in which case no notice is added.
   * Empty in a dry-run.
   */
  readonly providerFailures: readonly string[];
  /**
   * Plural-category keys verbatra synthesized this run (for example a Polish `items_few` the source
   * never supplied), kept distinct from {@link translated}. Empty unless plural generation was enabled
   * and acted, and empty in a dry-run.
   */
  readonly generated: readonly string[];
  /**
   * Candidate keys never sent to the provider because a configured `maxTokens` budget already tripped
   * in `"stop"` mode: keys remaining in the current locale once the ceiling was crossed, and every
   * candidate key of a later, fully-skipped locale. Always present, empty by default, same convention as
   * {@link LocaleSummary.integrityMismatches} and {@link LocaleSummary.providerFailures}. Each key keeps
   * its prior lock hash and is picked up again next run, exactly like a `providerFailures` key.
   */
  readonly budgetWithheld: readonly string[];
  /**
   * Summed token usage across every provider call for this locale (main translation plus plural
   * generation). Absent when no call in this locale reported usage: a dry-run, a token-less provider
   * (DeepL), or a locale with nothing to translate. Never a fabricated `{ inputTokens: 0, outputTokens: 0 }`.
   */
  readonly usage?: UsageSummary;
  /**
   * Notices for this locale: provider notices (e.g. DeepL graceful-degradation) and SDK notices
   * (e.g. a target language needing more CLDR plural categories than the source supplies). Empty when
   * nothing was degraded or flagged.
   */
  readonly notices: readonly LocaleNotice[];
  /**
   * Keys accepted and written this run that the review heuristics flagged for a second look, sorted
   * by key. Distinct from the placeholder/ICU integrity gate: a review flag is advisory only and never
   * withholds a key, so this never double-reports a key already surfaced through
   * {@link LocaleSummary.integrityMismatches} or {@link LocaleSummary.providerFailures}. Empty when
   * nothing was flagged, always empty for a workbook import (which never calls a provider or recomputes
   * flags on its own path).
   */
  readonly needsReview: readonly NeedsReviewEntry[];
  /**
   * Present only when status is "failed": a structured, secret-free error. `code` is a PRESERVED string
   * (the underlying provider/adapter error's `code`, or `"LOCALE_FAILED"` as a fallback), intentionally
   * wider than {@link SdkErrorCode}, so do not treat it as a closed set.
   */
  readonly error?: { readonly code: string; readonly message: string };
}

/** The aggregate result of a run across all target locales. */
export interface RunSummary {
  /** Whether this was a dry-run (no provider calls, no writes). */
  readonly dryRun: boolean;
  /** One {@link LocaleSummary} per target locale, in config order. */
  readonly locales: readonly LocaleSummary[];
  /** Locales whose run succeeded. */
  readonly succeeded: readonly string[];
  /** Locales whose run failed (see each locale's `error`). */
  readonly failed: readonly string[];
  /**
   * Summed token usage across every locale's {@link LocaleSummary.usage}. Absent when no locale in the
   * run reported usage (a dry-run, or an all-token-less-provider run).
   */
  readonly usage?: UsageSummary;
  /** The run-wide token-budget outcome; present only when `maxTokens` is configured. */
  readonly budget?: RunBudget;
}
