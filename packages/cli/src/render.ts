import type { LocaleSummary, RunSummary, WatchRunResult } from "@verbatra/sdk";

/** A structured, secret-free error projection (matches the SDK's failed-result shape). */
export interface RenderableError {
  readonly code: string;
  readonly message: string;
}

/** Project an unknown thrown value to a structured, secret-free { code, message } — never a stack. */
export function toRenderableError(error: unknown): RenderableError {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "CLI_ERROR", message: error.message };
  }
  return { code: "CLI_ERROR", message: String(error) };
}

/** Human-readable run summary: one line per locale, then an aggregate. Plain text, no emoji. */
export function renderHuman(summary: RunSummary): string {
  const header = summary.dryRun ? "verbatra translate (dry run)" : "verbatra translate";
  const localeLines = summary.locales.map(renderLocaleLine);
  const aggregate = `${summary.succeeded.length} succeeded, ${summary.failed.length} failed${
    summary.dryRun ? " (dry run: nothing written)" : ""
  }`;
  return [header, ...localeLines, aggregate].join("\n");
}

function renderLocaleLine(locale: LocaleSummary): string {
  if (locale.status === "failed") {
    const suffix = locale.error ? ` [${locale.error.code}] ${locale.error.message}` : "";
    return `  ${locale.locale}: failed${suffix}`;
  }
  // translated and unchanged are always shown; the rest only when non-zero, to keep lines terse.
  const counts: ReadonlyArray<readonly [number, string, boolean]> = [
    [locale.translated.length, "translated", true],
    [locale.unchanged.length, "unchanged", true],
    [locale.orphaned.length, "orphaned", false],
    [locale.invalidIcuSource.length, "invalid-ICU skipped", false],
    [locale.integrityMismatches.length, "integrity-withheld", false],
    [locale.notices.length, "notices", false],
  ];
  const shown = counts
    .filter(([count, , always]) => always || count > 0)
    .map(([count, label]) => `${count} ${label}`);
  return `  ${locale.locale}: ${shown.join(", ")}`;
}

/** The run summary as compact JSON (a single line). */
export function renderJson(summary: RunSummary): string {
  return JSON.stringify(summary);
}

/** A single watch run as one NDJSON record (success carries the summary; failure the error). */
export function renderRunResultNdjson(result: WatchRunResult): string {
  return JSON.stringify(result);
}

/** Human rendering of a single watch run (success -> the summary; failure -> the error line). */
export function renderRunResultHuman(result: WatchRunResult): string {
  return result.status === "succeeded" ? renderHuman(result.summary) : renderError(result.error);
}

/** A structured error as a clear one-line message. Never a raw stack. */
export function renderError(error: RenderableError): string {
  return `verbatra: error [${error.code}] ${error.message}`;
}
