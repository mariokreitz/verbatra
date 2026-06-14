import type { ProviderNotice } from "@verbatra/ai-providers";

/** Structured outcome for one target locale. */
export interface LocaleSummary {
  readonly locale: string;
  readonly status: "succeeded" | "failed";
  /**
   * Keys translated and written this run. In dry-run, the keys that WOULD be translated
   * (the provider is not called and nothing is written).
   */
  readonly translated: readonly string[];
  readonly unchanged: readonly string[];
  readonly orphaned: readonly string[];
  /** Source keys flagged invalid-ICU that were skipped for translation this run. */
  readonly invalidIcuSource: readonly string[];
  /** Translated keys that failed the placeholder-integrity check and were withheld. */
  readonly integrityMismatches: readonly string[];
  readonly notices: readonly ProviderNotice[];
  /** Present only when status is "failed": a structured, secret-free error. */
  readonly error?: { readonly code: string; readonly message: string };
}

/** The aggregate result of a run across all target locales. */
export interface RunSummary {
  readonly dryRun: boolean;
  readonly locales: readonly LocaleSummary[];
  readonly succeeded: readonly string[];
  readonly failed: readonly string[];
}
