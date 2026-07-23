import type {
  CheckSummary,
  DiffSummary,
  LocaleDiff,
  LocaleSummary,
  LockWaitEvent,
  ProgressEvent,
  RunBudget,
  RunSummary,
  UsageSummary,
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
 * Projects an unknown thrown value to a structured, secret-free `{ code, message }`. Never a stack.
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
 * Renders a run summary human-readably: a header, one line per locale, optional usage and budget
 * lines, then an aggregate.
 *
 * @param summary - The SDK run summary to render.
 * @param command - The command label for the header (defaults to "translate"); `import` reuses it.
 * @returns The multi-line human report (no trailing newline).
 */
export function renderHuman(summary: RunSummary, command = "translate"): string {
  const header = summary.dryRun ? `verbatra ${command} (dry run)` : `verbatra ${command}`;
  const localeLines = summary.locales.map(renderLocaleLine);
  const aggregate = `${summary.succeeded.length} succeeded, ${summary.partial.length} partial, ${summary.failed.length} failed${
    summary.dryRun ? " (dry run: nothing written)" : ""
  }`;
  const usageLine = summary.usage !== undefined ? [`  total: ${renderTokens(summary.usage)}`] : [];
  const budgetLine = summary.budget !== undefined ? [renderBudgetLine(summary.budget)] : [];
  return [header, ...localeLines, ...usageLine, ...budgetLine, aggregate].join("\n");
}

/** Input plus output token counts as one human-readable fragment; shared by the locale and run lines. */
function renderTokens(usage: UsageSummary): string {
  return `${usage.inputTokens + usage.outputTokens} tokens (${usage.inputTokens} in, ${usage.outputTokens} out)`;
}

/**
 * The run-wide budget line. `supported: false` is rendered explicitly (the guardrail is configured but
 * inert against this provider) rather than omitted, so it is never mistaken for a working cap.
 */
function renderBudgetLine(budget: RunBudget): string {
  if (!budget.supported) {
    return (
      `  budget: ${budget.maxTokens} tokens configured (${budget.behavior}), ` +
      "not supported by this provider (no usage reported)"
    );
  }
  const status = budget.exceeded ? "exceeded" : "within budget";
  return `  budget: ${budget.tokensUsed}/${budget.maxTokens} tokens (${budget.behavior}), ${status}`;
}

/** One locale line: the failure code and message, or the counts (translated and unchanged always, the rest only when non-zero). */
function renderLocaleLine(locale: LocaleSummary): string {
  if (locale.status === "failed") {
    const suffix = locale.error ? ` [${locale.error.code}] ${locale.error.message}` : "";
    return `  ${locale.locale}: failed${suffix}`;
  }
  const counts: ReadonlyArray<readonly [number, string, boolean]> = [
    [locale.translated.length, "translated", true],
    [locale.unchanged.length, "unchanged", true],
    [locale.generated.length, "generated", false],
    [locale.orphaned.length, "orphaned", false],
    [locale.pruned.length, "pruned", false],
    [locale.invalidIcuSource.length, "invalid-ICU skipped", false],
    [locale.integrityMismatches.length, "integrity-withheld", false],
    [locale.budgetWithheld.length, "budget-withheld", false],
    [locale.needsReview.length, "needs-review", false],
    [locale.notices.length, "notices", false],
  ];
  const shown = counts
    .filter(([count, , always]) => always || count > 0)
    .map(([count, label]) => `${count} ${label}`);
  const tokenSuffix = locale.usage !== undefined ? `, ${renderTokens(locale.usage)}` : "";
  return `  ${locale.locale}: ${shown.join(", ")}${tokenSuffix}`;
}

/**
 * The `translate --json` output contract: the SDK's `RunSummary` as one compact JSON object on a line.
 *
 * @param summary - The SDK run summary.
 * @returns A single-line JSON object string.
 */
export function renderJson(summary: RunSummary): string {
  return JSON.stringify(summary);
}

/**
 * The `watch --json` output contract: one `WatchRunResult` per run as a single NDJSON record.
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
 * counts plus an in-sync marker, then an overall in-sync line.
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
 * as add / re-translate / orphaned (every key listed), then an aggregate trailer. A locale with nothing
 * missing, changed, or orphaned collapses to a single "no pending changes" line.
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

/** The "held by pid X since T" fragment of the human waiting line, or empty when the holder is unknown. */
function renderLockHolder(event: LockWaitEvent): string {
  const holder = event.holder;
  if (holder?.pid === undefined && holder?.acquiredAt === undefined) {
    return "";
  }
  const pid = holder.pid !== undefined ? ` by pid ${holder.pid}` : "";
  const since = holder.acquiredAt !== undefined ? ` since ${holder.acquiredAt}` : "";
  return ` (held${pid}${since})`;
}

/**
 * Human-readable wait-progress line for a contended write lock: names the lock path, the holder when
 * known, and how long we have waited, plus the hint that a truly orphaned lock can be deleted. Meant
 * for stderr, so it never mixes with `--json` stdout.
 *
 * @param event - One wait-progress event from the SDK's `onLockWait`.
 * @returns The single-line message (no trailing newline).
 */
export function renderLockWaitHuman(event: LockWaitEvent): string {
  const waitedSeconds = Math.round(event.elapsedMs / 1000);
  return (
    `verbatra: waiting for the write lock at ${event.lockPath}${renderLockHolder(event)}; ` +
    `waited ${waitedSeconds}s. If no verbatra process is running, this lock is orphaned and can be deleted.`
  );
}

/**
 * The `--json` wait-progress contract: one structured lock-wait record. Written to stderr, never
 * stdout, so it never corrupts the run summary or NDJSON stream a `--json` run emits on stdout.
 *
 * @param event - One wait-progress event from the SDK's `onLockWait`.
 * @returns A single-line JSON record string.
 */
export function renderLockWaitJson(event: LockWaitEvent): string {
  return JSON.stringify({ type: "lock-wait", ...event });
}

/**
 * One wait-progress line for the active output mode: a structured JSON record under `--json`, the
 * human line otherwise. Callers write it to stderr, keeping stdout clean in both modes.
 *
 * @param event - One wait-progress event from the SDK's `onLockWait`.
 * @param json - Whether the command is in `--json` mode.
 * @returns The single-line message (no trailing newline).
 */
export function renderLockWait(event: LockWaitEvent, json: boolean): string {
  return json ? renderLockWaitJson(event) : renderLockWaitHuman(event);
}

/**
 * Human-readable progress line for one run event: the locale about to start (with its 1-based
 * position), a provider sub-batch reached, a locale finished (with its translated count), or the
 * whole run finished. Meant for stderr, so it never mixes with `--json` stdout.
 *
 * @param event - One progress event from the SDK's `onProgress`.
 * @returns The single-line message (no trailing newline).
 */
export function renderProgressHuman(event: ProgressEvent): string {
  switch (event.type) {
    case "locale-started":
      return `verbatra: [${event.localeIndex + 1}/${event.totalLocales}] translating ${event.locale}`;
    case "sub-batch":
      return `verbatra: ${event.locale} batch ${event.batchIndex}/${event.totalBatches}`;
    case "locale-finished":
      return `verbatra: ${event.locale} done, ${event.translated} translated`;
    case "run-finished":
      return `verbatra: run finished, ${event.localesCompleted} locales processed`;
  }
}

/**
 * The `--json` progress contract: one structured record per event. The event already carries its own
 * `type` discriminant, so it is emitted verbatim. Written to stderr, never stdout, so it never
 * corrupts the run summary or NDJSON stream a `--json` run emits on stdout.
 *
 * @param event - One progress event from the SDK's `onProgress`.
 * @returns A single-line JSON record string.
 */
export function renderProgressJson(event: ProgressEvent): string {
  return JSON.stringify(event);
}

/**
 * One progress line for the active output mode: a structured JSON record under `--json`, the human
 * line otherwise. Callers write it to stderr, keeping stdout clean in both modes.
 *
 * @param event - One progress event from the SDK's `onProgress`.
 * @param json - Whether the command is in `--json` mode.
 * @returns The single-line message (no trailing newline).
 */
export function renderProgress(event: ProgressEvent, json: boolean): string {
  return json ? renderProgressJson(event) : renderProgressHuman(event);
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
