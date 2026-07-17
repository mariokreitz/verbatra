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
    integrityMismatches: [],
    providerFailures: [],
    budgetWithheld: [],
    generated: [],
    notices: [],
    needsReview: [],
    error: describeError(error),
  };
}

/** Partitions locale summaries into the succeeded and failed locale-name lists of a run summary. */
export function partition(locales: readonly LocaleSummary[]): {
  succeeded: readonly string[];
  failed: readonly string[];
} {
  const succeeded = locales.filter((s) => s.status === "succeeded").map((s) => s.locale);
  const failed = locales.filter((s) => s.status === "failed").map((s) => s.locale);
  return { succeeded, failed };
}
