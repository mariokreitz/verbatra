import type { CheckSummary, LocaleSummary, RunSummary, WatchRunResult } from "@verbatra/sdk";

/** A structured, secret-free error projection (matches the SDK's failed-result shape). */
export interface RenderableError {
  /** A preserved error code (the thrown error's `code`, or `"CLI_ERROR"` as a fallback). */
  readonly code: string;
  /** A one-line, secret-free message; never a stack. */
  readonly message: string;
}

/**
 * Project an unknown thrown value to a structured, secret-free `{ code, message }`. Never a stack.
 *
 * @param error - The caught value (an `Error`, an SDK error, or anything thrown).
 * @returns The projection; `code` is the error's string `code` or `"CLI_ERROR"` when it has none.
 */
export function toRenderableError(error: unknown): RenderableError {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "CLI_ERROR", message: error.message };
  }
  return { code: "CLI_ERROR", message: String(error) };
}

/**
 * Human-readable run summary: one line per locale, then an aggregate. Plain text, no emoji.
 *
 * @param summary - The SDK run summary to render.
 * @param command - The command label for the header (defaults to "translate"); `import` reuses this
 *   same formatter unchanged, so the per-locale lines and exit-code rule are shared with no special case.
 * @returns The multi-line human report (no trailing newline).
 */
export function renderHuman(summary: RunSummary, command = "translate"): string {
  const header = summary.dryRun ? `verbatra ${command} (dry run)` : `verbatra ${command}`;
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
    [locale.generated.length, "generated", false],
    [locale.orphaned.length, "orphaned", false],
    [locale.pruned.length, "pruned", false],
    [locale.invalidIcuSource.length, "invalid-ICU skipped", false],
    [locale.integrityMismatches.length, "integrity-withheld", false],
    [locale.notices.length, "notices", false],
  ];
  const shown = counts
    .filter(([count, , always]) => always || count > 0)
    .map(([count, label]) => `${count} ${label}`);
  return `  ${locale.locale}: ${shown.join(", ")}`;
}

/**
 * The `translate --json` output contract: the SDK's `RunSummary` as one compact JSON object on a single
 * line, surfaced verbatim (no CLI-side reshaping).
 *
 * @param summary - The SDK run summary.
 * @returns A single-line JSON object string.
 */
export function renderJson(summary: RunSummary): string {
  return JSON.stringify(summary);
}

/**
 * The `watch --json` output contract: one `WatchRunResult` per run as a single NDJSON record (success
 * carries the summary; failure the error), surfaced verbatim from the SDK.
 *
 * @param result - The outcome of one watch run.
 * @returns A single-line JSON record string (one NDJSON line).
 */
export function renderRunResultNdjson(result: WatchRunResult): string {
  return JSON.stringify(result);
}

/**
 * Human rendering of a single watch run.
 *
 * @param result - The outcome of one watch run.
 * @returns The summary report on success, or the one-line error on failure.
 */
export function renderRunResultHuman(result: WatchRunResult): string {
  return result.status === "succeeded" ? renderHuman(result.summary) : renderError(result.error);
}

/** The export outcome the CLI renders: where the workbook went and the per-locale row counts. */
export interface ExportRenderable {
  readonly path: string;
  readonly locales: readonly { readonly locale: string; readonly rows: number }[];
}

/**
 * Human-readable export report: the output path, then one line per locale with its row count.
 *
 * @param result - The SDK export result.
 * @returns The multi-line human report (no trailing newline).
 */
export function renderExportHuman(result: ExportRenderable): string {
  const localeLines = result.locales.map((l) => `  ${l.locale}: ${l.rows} rows`);
  const total = result.locales.reduce((sum, l) => sum + l.rows, 0);
  return [
    `verbatra export -> ${result.path}`,
    ...localeLines,
    `${total} rows across ${result.locales.length} locales`,
  ].join("\n");
}

/** The `export --json` contract: the SDK export result as one compact JSON object on one line. */
export function renderExportJson(result: ExportRenderable): string {
  return JSON.stringify(result);
}

/**
 * Human-readable check report: a header, one line per locale with its missing, stale, and up-to-date
 * counts plus an in-sync marker, then an overall in-sync line. Plain text, no emoji.
 *
 * @param summary - The SDK check summary.
 * @returns The multi-line human report (no trailing newline).
 */
export function renderCheckHuman(summary: CheckSummary): string {
  const localeLines = summary.locales.map(
    (l) =>
      `  ${l.locale}: ${l.missing} missing, ${l.stale} stale, ${l.upToDate} up-to-date (${
        l.inSync ? "in sync" : "out of sync"
      })`,
  );
  const overall = summary.inSync
    ? "all locales in sync"
    : "out of sync (run verbatra translate to update)";
  return ["verbatra check", ...localeLines, overall].join("\n");
}

/** The `check --json` contract: the SDK check summary as one compact JSON object on one line. */
export function renderCheckJson(summary: CheckSummary): string {
  return JSON.stringify(summary);
}

/**
 * A structured error as a clear one-line message. Never a raw stack.
 *
 * @param error - The structured error to render.
 * @returns A single line of the form `verbatra: error [CODE] message`.
 */
export function renderError(error: RenderableError): string {
  return `verbatra: error [${error.code}] ${error.message}`;
}
