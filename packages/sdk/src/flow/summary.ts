import type { ProviderNotice } from "@verbatra/ai-providers";

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
  /** Target keys with no corresponding source key (candidates for removal). */
  readonly orphaned: readonly string[];
  /** Source keys flagged invalid-ICU that were skipped for translation this run. */
  readonly invalidIcuSource: readonly string[];
  /** Translated keys that failed the placeholder-integrity check and were withheld. */
  readonly integrityMismatches: readonly string[];
  /** Provider notices for this locale (e.g. DeepL graceful-degradation); empty for LLM providers. */
  readonly notices: readonly ProviderNotice[];
  /**
   * Present only when status is "failed": a structured, secret-free error. `code` is a PRESERVED string
   * (the underlying provider/adapter error's `code`, or `"LOCALE_FAILED"` as a fallback) — intentionally
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
