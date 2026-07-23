import type { LocaleSummary } from "./summary.js";

/**
 * Projects a caught value to a structured `{ code, message }`. An `Error` carrying a string `code`
 * keeps it; anything else falls back to the `LOCALE_FAILED` code with the stringified value.
 */
export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "LOCALE_FAILED", message: error.message };
  }
  return { code: "LOCALE_FAILED", message: String(error) };
}

/** Builds a failed {@link LocaleSummary}: every list empty, plus the structured error. */
export function failureSummary(locale: string, error: unknown): LocaleSummary {
  return {
    locale,
    status: "failed",
    translated: [],
    unchanged: [],
    orphaned: [],
    pruned: [],
    invalidIcuSource: [],
    cacheHits: [],
    integrityMismatches: [],
    providerFailures: [],
    budgetWithheld: [],
    generated: [],
    notices: [],
    needsReview: [],
    unfilled: [],
    malformedRows: [],
    duplicateKeys: [],
    error: describeError(error),
  };
}

/** The accepted-versus-withheld counts that determine a locale's honest {@link LocaleSummary.status}. */
export interface LocaleStatusParts {
  /** Keys translated and written this run (a dry-run's would-be translations count here too). */
  readonly translated: readonly string[];
  /** Keys served from the translation-memory cache and written; counts toward acceptance alongside `translated`. */
  readonly cacheHits: readonly string[];
  /** Plural forms synthesized and written this run; counts toward acceptance alongside `translated`. */
  readonly generated: readonly string[];
  /** Keys withheld because the translation failed the placeholder-integrity check. */
  readonly integrityMismatches: readonly string[];
  /** Keys withheld because nothing was translated for them (a failed or empty provider response). */
  readonly providerFailures: readonly string[];
  /** Keys never sent because a configured token budget tripped in `"stop"` mode. */
  readonly budgetWithheld: readonly string[];
}

/**
 * Derives a locale's honest run status from what it accepted versus what it withheld. Accepted means
 * something was written to disk: a translated key or a generated plural form. `"succeeded"` when
 * nothing was withheld (including a genuine no-op with no candidate keys at all); `"partial"` when at
 * least one key was accepted (translated, cache-served, or generated) but at least one was withheld;
 * `"failed"` when candidate keys were withheld and nothing was accepted at all. Withholding means any
 * of `integrityMismatches`, `providerFailures`, or `budgetWithheld` is non-empty.
 */
export function deriveLocaleStatus(parts: LocaleStatusParts): LocaleSummary["status"] {
  const withheld =
    parts.integrityMismatches.length > 0 ||
    parts.providerFailures.length > 0 ||
    parts.budgetWithheld.length > 0;
  if (!withheld) {
    return "succeeded";
  }
  const accepted =
    parts.translated.length > 0 || parts.cacheHits.length > 0 || parts.generated.length > 0;
  return accepted ? "partial" : "failed";
}

/**
 * Partitions locale summaries into the succeeded, partial, and failed locale-name lists of a run
 * summary. Every locale lands in exactly one list; a partial or failed locale is never reported as
 * succeeded.
 */
export function partition(locales: readonly LocaleSummary[]): {
  succeeded: readonly string[];
  partial: readonly string[];
  failed: readonly string[];
} {
  const namesWith = (status: LocaleSummary["status"]): readonly string[] =>
    locales.filter((s) => s.status === status).map((s) => s.locale);
  return {
    succeeded: namesWith("succeeded"),
    partial: namesWith("partial"),
    failed: namesWith("failed"),
  };
}
