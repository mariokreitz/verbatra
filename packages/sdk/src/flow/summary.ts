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

/**
 * One row a workbook import could not read: the 1-based worksheet row number and the header label of
 * the offending column. Carries no cell content, so untrusted workbook text never reaches the summary.
 */
export interface MalformedRowReport {
  /** The 1-based worksheet row number of the malformed row. */
  readonly row: number;
  /** The header label of the column the row was rejected on (for example "Status"). */
  readonly column: string;
}

/**
 * One duplicate-key conflict a workbook import found in a locale's sheet: the duplicated key and the
 * 1-based worksheet row number of the later (losing) occurrence. The first occurrence is the winner.
 */
export interface DuplicateKeyReport {
  /** The key that appeared more than once in the locale's sheet. */
  readonly key: string;
  /** The 1-based worksheet row number of the later occurrence that lost to the first. */
  readonly row: number;
}

/** Structured outcome for one target locale; surfaced as data on the run, never thrown. */
export interface LocaleSummary {
  /** The target locale this summary is for. */
  readonly locale: string;
  /**
   * This locale's honest run status (a non-success does not abort the run). `"succeeded"` when
   * nothing was withheld, including a genuine no-op with no candidate keys at all. `"partial"` when
   * at least one key was accepted and written (a {@link LocaleSummary.translated} key or a
   * {@link LocaleSummary.generated} plural form) but at least one was withheld (any of
   * {@link LocaleSummary.integrityMismatches}, {@link LocaleSummary.providerFailures}, or
   * {@link LocaleSummary.budgetWithheld} non-empty). `"failed"` when the locale had candidate keys
   * but accepted nothing at all (neither translated nor generated) while withholding at least one.
   * Withheld keys keep their prior lock hash and retry next run.
   *
   * A workbook import's structural findings, {@link LocaleSummary.unfilled},
   * {@link LocaleSummary.malformedRows}, and {@link LocaleSummary.duplicateKeys}, deliberately do NOT
   * feed this status: they are surfaced in their own lists (and the CLI) but are not withholdings of
   * an attempted translation, so a locale that dropped a malformed row, collapsed a duplicate key, or
   * left a `changed` row unfilled while accepting its other rows can still be `"succeeded"`.
   */
  readonly status: "succeeded" | "partial" | "failed";
  /**
   * Keys translated and written this run. In dry-run, the keys that would be translated
   * (the provider is not called and nothing is written).
   */
  readonly translated: readonly string[];
  /** Keys already up to date, left unchanged this run. */
  readonly unchanged: readonly string[];
  /** Target keys with no corresponding source key (candidates for removal). Reported regardless of pruning. */
  readonly orphaned: readonly string[];
  /**
   * Orphaned keys actually removed this run because pruning was on. In a dry-run with pruning on, the keys
   * that would be removed. Empty when pruning is off (the orphans then survive and are reported in
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
   * Keys the workbook exported as `changed` (needing an updated translation) that the translator left
   * blank, drifted or not, sorted by key. Pending work made visible: the row is skipped (nothing is
   * written and the prior lock baseline is kept), but the key is surfaced so an unfinished import is
   * never silently reported as done. Only a workbook import populates this; the provider path, which
   * never leaves a candidate key unfilled by a person, always leaves it empty.
   */
  readonly unfilled: readonly string[];
  /**
   * Rows a workbook import could not read for this locale, each by worksheet row number and offending
   * column, in row order. The sheet's other rows still import; a malformed row is reported, not
   * written. Only a workbook import populates this; the provider path always leaves it empty.
   */
  readonly malformedRows: readonly MalformedRowReport[];
  /**
   * Duplicate-key conflicts a workbook import found in this locale's sheet, in row order. The rule is
   * first occurrence wins: the first row for a key is judged and its later occurrences are reported
   * here and otherwise ignored. Only a workbook import populates this; the provider path always leaves
   * it empty.
   */
  readonly duplicateKeys: readonly DuplicateKeyReport[];
  /**
   * A structured, secret-free error for a locale that threw (an adapter/lock/provider-construction
   * failure isolated as data): present only on a "failed" locale, and only that throw path sets it.
   * A locale that is "failed" because every candidate key was withheld (all under `providerFailures`,
   * `integrityMismatches`, or `budgetWithheld`) carries those lists and any notices instead, and has
   * no `error`. `code` is a preserved string (the underlying provider/adapter error's `code`, or
   * `"LOCALE_FAILED"` as a fallback), intentionally wider than {@link SdkErrorCode}, so do not treat
   * it as a closed set.
   */
  readonly error?: { readonly code: string; readonly message: string };
}

/** The aggregate result of a run across all target locales. */
export interface RunSummary {
  /** Whether this was a dry-run (no provider calls, no writes). */
  readonly dryRun: boolean;
  /** One {@link LocaleSummary} per target locale, in config order. */
  readonly locales: readonly LocaleSummary[];
  /** Locales whose run succeeded with nothing withheld (status `"succeeded"`). */
  readonly succeeded: readonly string[];
  /**
   * Locales that wrote at least one translation but withheld at least one candidate key (status
   * `"partial"`). A partial locale still exits the CLI `0`: it made progress, and its withheld keys
   * retry next run. Never overlaps `succeeded` or `failed`.
   */
  readonly partial: readonly string[];
  /** Locales whose run failed, having accepted nothing (status `"failed"`; see each locale's `error`). */
  readonly failed: readonly string[];
  /**
   * Summed token usage across every locale's {@link LocaleSummary.usage}. Absent when no locale in the
   * run reported usage (a dry-run, or an all-token-less-provider run).
   */
  readonly usage?: UsageSummary;
  /** The run-wide token-budget outcome; present only when `maxTokens` is configured. */
  readonly budget?: RunBudget;
}
