import type { LocaleSummary } from "./summary.js";

/**
 * Project a caught value to a structured, secret-free `{ code, message }`. Per-locale failures are
 * Adapter/Provider/Exchange errors (all secret-free) which carry a string `code`; an SdkError is an
 * Error with a `code` too. Anything without a string code falls back to `"LOCALE_FAILED"`.
 */
export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "LOCALE_FAILED", message: error.message };
  }
  return { code: "LOCALE_FAILED", message: String(error) };
}

/** A failed {@link LocaleSummary}: empty lists, `notices: []`, and the structured error. */
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
    generated: [],
    notices: [],
    error: describeError(error),
  };
}

/** Partition locale summaries into the succeeded/failed locale-name lists of a RunSummary. */
export function partition(locales: readonly LocaleSummary[]): {
  succeeded: readonly string[];
  failed: readonly string[];
} {
  const succeeded = locales.filter((s) => s.status === "succeeded").map((s) => s.locale);
  const failed = locales.filter((s) => s.status === "failed").map((s) => s.locale);
  return { succeeded, failed };
}
