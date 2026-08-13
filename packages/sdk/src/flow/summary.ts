import type { ProviderNotice, ReviewReasonCode } from "@verbatra/ai-providers";

/**
 * Conditions the SDK itself reports on a locale, as opposed to the {@link ProviderNotice} codes a
 * provider raises. Each marks a run that completed but did something a caller may want to know
 * about.
 *
 * - `PLURAL_CATEGORIES_INCOMPLETE`: plural generation could not produce every category the target
 *   language requires, so the entry is written with the categories that were produced.
 * - `SUB_BATCH_FAILED`: one sub-batch of a locale failed while others succeeded. The locale is
 *   reported as `partial` rather than failed.
 * - `BLANK_ROW_BASELINE_RETAINED`: an imported handoff row was blank, so the existing translation
 *   and its lock-file baseline were kept rather than being erased.
 * - `BUDGET_TOKENS_EXCEEDED`: the configured token budget was passed. Under `warn` the run
 *   continues; under `stop` the remaining keys are withheld.
 * - `CACHE_VERSION_UNRECOGNIZED`: the translation memory is at a version this release does not
 *   understand, so it was ignored rather than trusted.
 */
export type SdkNoticeCode =
  | "PLURAL_CATEGORIES_INCOMPLETE"
  | "SUB_BATCH_FAILED"
  | "BLANK_ROW_BASELINE_RETAINED"
  | "BUDGET_TOKENS_EXCEEDED"
  | "CACHE_VERSION_UNRECOGNIZED";

/**
 * Token usage as reported by the provider. Absent when the provider does not report usage, which is
 * the case for machine-translation APIs such as DeepL that do not bill in tokens.
 */
export interface UsageSummary {
  /** Tokens consumed by the prompts sent to the provider. */
  readonly inputTokens: number;
  /** Tokens consumed by the provider's responses. */
  readonly outputTokens: number;
}

/**
 * What a run does when it passes its token budget: `warn` finishes the work and reports the
 * overrun, `stop` withholds the remaining keys.
 */
export type BudgetBehavior = "warn" | "stop";

/** The token budget in force for a run, and how much of it was actually consumed. */
export interface RunBudget {
  /** The configured ceiling, in tokens. */
  readonly maxTokens: number;
  /** Whether passing the ceiling warns or stops the run. */
  readonly behavior: BudgetBehavior;
  /**
   * Whether the configured provider reports usage at all. When false the budget cannot be enforced,
   * because there is nothing to count.
   */
  readonly supported: boolean;
  /** Tokens consumed across the whole run so far. */
  readonly tokensUsed: number;
  /** True once `tokensUsed` passed `maxTokens`. */
  readonly exceeded: boolean;
}

/** A condition the SDK reported on a locale. See {@link SdkNoticeCode}. */
export interface SdkNotice {
  /** The stable notice code. Branch on this, not on the message. */
  readonly code: SdkNoticeCode;
  /** A human-readable description of the condition. */
  readonly message: string;
}

/**
 * Any notice attached to a locale: either one the provider raised, such as a downgraded formality
 * or an ignored glossary, or one the SDK raised. Discriminate on `code`.
 */
export type LocaleNotice = ProviderNotice | SdkNotice;

/**
 * A translated key the provider layer flagged as worth a human look. The translation was still
 * written; these are advisory quality signals, not rejections.
 */
export interface NeedsReviewEntry {
  /** The key that was flagged. */
  readonly key: string;
  /** Why it was flagged. A key can carry more than one reason. */
  readonly reasons: readonly ReviewReasonCode[];
}

/** A row of an imported handoff that could not be read. Reported rather than aborting the import. */
export interface MalformedRowReport {
  /** The row's 1-based index within its sheet or file. */
  readonly row: number;
  /**
   * The 1-based physical line in the source file, for delimited formats where a quoted value can
   * span several lines. Absent for `.xlsx`, which has rows but no lines.
   */
  readonly line?: number;
  /** The column whose value was missing or unusable. */
  readonly column: string;
}

/**
 * A key that appeared more than once in an imported handoff. The first occurrence wins and the rest
 * are reported here, so a translator who duplicated a row learns which value was actually used.
 */
export interface DuplicateKeyReport {
  /** The key that appeared more than once. */
  readonly key: string;
  /** The 1-based row index of the ignored occurrence. */
  readonly row: number;
  /** The 1-based physical line of the ignored occurrence, for delimited formats. Absent for `.xlsx`. */
  readonly line?: number;
}

/**
 * Everything that happened for one locale during a run. The key lists are disjoint accounts of what
 * became of each key, so a caller can reconstruct the whole run without re-reading any file.
 *
 * A locale that failed outright still appears here with `status: "failed"` and an `error`, rather
 * than the whole run throwing. That is the central contract of {@link translate}: one unreachable
 * provider or one unwritable file does not discard the locales that succeeded.
 */
export interface LocaleSummary {
  /** The target locale this summary describes. */
  readonly locale: string;
  /**
   * `succeeded` when everything asked for was done, `partial` when some keys were translated and
   * others were not, and `failed` when the locale produced no usable result.
   */
  readonly status: "succeeded" | "partial" | "failed";
  /** Keys newly translated by the provider in this run. */
  readonly translated: readonly string[];
  /** Keys already up to date against the lock-file baseline, so no provider call was made. */
  readonly unchanged: readonly string[];
  /** Keys present in this locale but no longer in the source. Reported, and removed only when pruning. */
  readonly orphaned: readonly string[];
  /** Orphaned keys that were actually removed, which happens only when the run was asked to prune. */
  readonly pruned: readonly string[];
  /**
   * Keys whose source text is not valid ICU. They are skipped rather than sent to the provider,
   * because a broken source message cannot yield a sound translation.
   */
  readonly invalidIcuSource: readonly string[];
  /** Keys served from the translation memory instead of the provider, and so not paid for. */
  readonly cacheHits: readonly string[];
  /**
   * Keys whose translation was refused by the integrity gate, for instance because it dropped a
   * placeholder. The previous translation, if any, is left untouched.
   */
  readonly integrityMismatches: readonly string[];
  /** Keys the provider failed to translate, for instance because their sub-batch errored. */
  readonly providerFailures: readonly string[];
  /** Keys whose plural categories were generated for the target language rather than translated one by one. */
  readonly generated: readonly string[];
  /** Keys not translated because the token budget was exhausted under `stop` behavior. */
  readonly budgetWithheld: readonly string[];
  /** Token usage for this locale. Absent when the provider does not report usage. */
  readonly usage?: UsageSummary;
  /** Provider and SDK notices raised while running this locale. Always present, possibly empty. */
  readonly notices: readonly LocaleNotice[];
  /** Translated keys flagged as worth a human look. The translations were still written. */
  readonly needsReview: readonly NeedsReviewEntry[];
  /** Keys left with no translation after the run, whatever the cause. */
  readonly unfilled: readonly string[];
  /** Unreadable rows from an imported handoff. Always empty for a {@link translate} run. */
  readonly malformedRows: readonly MalformedRowReport[];
  /** Repeated keys from an imported handoff. Always empty for a {@link translate} run. */
  readonly duplicateKeys: readonly DuplicateKeyReport[];
  /**
   * Why this locale failed, when the failure came from a thrown error. The `code` is the failure's
   * own code where it has one, and `LOCALE_FAILED` otherwise. Never carries a secret.
   *
   * Absent unless `status` is `failed`, but a `failed` locale does not always carry it: a locale
   * whose every key was withheld by the integrity gate, a provider failure, or the token budget is
   * `failed` with nothing thrown, so this stays undefined and the withheld keys are the account of
   * what went wrong. Treat it as an optional detail on a failure, never as the failure test.
   */
  readonly error?: {
    /** The failure's own code where it had one, and `LOCALE_FAILED` otherwise. */
    readonly code: string;
    /** A human-readable description of the failure. Never contains a secret. */
    readonly message: string;
  };
}

/**
 * The result of a whole run, returned by {@link translate}, {@link watch}, and
 * {@link importWorkbook}.
 *
 * Per-locale outcomes are data, not exceptions: inspect `failed` and `partial` to decide an exit
 * code rather than relying on the call to throw. Only whole-run failures, such as an invalid config
 * or an unreadable source file, throw an {@link SdkError}.
 */
export interface RunSummary {
  /** True when the run computed everything but wrote nothing and called no provider. */
  readonly dryRun: boolean;
  /** The full per-locale account, in configured target order. */
  readonly locales: readonly LocaleSummary[];
  /** Names of the locales whose status is `succeeded`. */
  readonly succeeded: readonly string[];
  /** Names of the locales whose status is `partial`. */
  readonly partial: readonly string[];
  /** Names of the locales whose status is `failed`. Check this before treating a run as clean. */
  readonly failed: readonly string[];
  /** Token usage summed across every locale. Absent when the provider does not report usage. */
  readonly usage?: UsageSummary;
  /** The token budget in force, present only when the config set one. */
  readonly budget?: RunBudget;
}
