import type { ProviderNotice } from "@verbatra/ai-providers";

/** A stable code for an SDK-originated notice (not a provider notice). */
export type SdkNoticeCode = "PLURAL_CATEGORIES_INCOMPLETE" | "SUB_BATCH_FAILED";

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
  /** Translated keys that failed the placeholder-integrity check and were withheld. */
  readonly integrityMismatches: readonly string[];
  /**
   * Plural-category keys verbatra synthesized this run (for example a Polish `items_few` the source
   * never supplied), kept distinct from {@link translated}. Empty unless plural generation was enabled
   * and acted, and empty in a dry-run.
   */
  readonly generated: readonly string[];
  /**
   * Notices for this locale: provider notices (e.g. DeepL graceful-degradation) and SDK notices
   * (e.g. a target language needing more CLDR plural categories than the source supplies). Empty when
   * nothing was degraded or flagged.
   */
  readonly notices: readonly LocaleNotice[];
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
}
