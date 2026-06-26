import type {
  CheckSummary,
  DiffSummary,
  LocaleDiff,
  LocaleSummary,
  RunSummary,
  WatchRunResult,
} from "@verbatra/sdk";

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

/** Column width that aligns the diff group keys past the longest label ("re-translate:"). */
const DIFF_GROUP_WIDTH = 14;

/** One grouped key line (`add:`, `re-translate:`, or `orphaned:`), or nothing when the group is empty. */
function renderDiffGroup(label: string, keys: readonly string[]): string | undefined {
  if (keys.length === 0) {
    return undefined;
  }
  return `    ${`${label}:`.padEnd(DIFF_GROUP_WIDTH)}${keys.join(", ")}`;
}

/** Render one locale: a "no pending changes" line, or a count header followed by its non-empty groups. */
function renderDiffLocale(locale: LocaleDiff): readonly string[] {
  const total = locale.missing.length + locale.changed.length + locale.orphaned.length;
  if (total === 0) {
    return [`  ${locale.locale}: no pending changes`];
  }
  const header = `  ${locale.locale}: ${locale.missing.length} to add, ${locale.changed.length} to re-translate, ${locale.orphaned.length} orphaned`;
  const groups = [
    renderDiffGroup("add", locale.missing),
    renderDiffGroup("re-translate", locale.changed),
    renderDiffGroup("orphaned", locale.orphaned),
  ].filter((line): line is string => line !== undefined);
  return [header, ...groups];
}

/**
 * Human-readable diff report: a header, then per locale a count header line and the key lists grouped
 * as add / re-translate / orphaned (every key listed, no truncation), then an aggregate trailer. A
 * locale with nothing missing, changed, or orphaned collapses to a single "no pending changes" line.
 * Plain text, no emoji.
 *
 * @param summary - The SDK diff summary.
 * @returns The multi-line human report (no trailing newline).
 */
export function renderDiffHuman(summary: DiffSummary): string {
  const localeLines = summary.locales.flatMap(renderDiffLocale);
  const count = summary.locales.length;
  const trailer = `${count} ${count === 1 ? "locale" : "locales"}, ${
    summary.hasPendingChanges ? "pending changes" : "no pending changes"
  }`;
  return ["verbatra diff", ...localeLines, trailer].join("\n");
}

/** The `diff --json` contract: the SDK diff summary as one compact JSON object on one line. */
export function renderDiffJson(summary: DiffSummary): string {
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
