/**
 * Pure core of the verbatra GitHub Action: turns the CLI's `--json` RunSummary and its exit code
 * into GitHub annotations, a job-summary markdown document, and the status the action exits with.
 * It does no I/O at all; annotate.mjs reads the captured files and writes the results.
 *
 * Everything placed into a workflow command is percent-encoded first. Locale names, provider error
 * messages, and raw CLI stderr are untrusted: a newline in any of them would end the `::error::`
 * line and let whatever follows be parsed as a second, forged workflow command.
 *
 * The exit status is the CLI's exit code propagated verbatim. The action consumes the CLI's
 * contract instead of re-deriving success or failure from the summary contents, so the two can
 * never disagree, and a run that produced no parseable summary is still reported as the failure it
 * was.
 */

/**
 * Escape a workflow-command data segment (the message after `::`) so a value cannot break out of the
 * command. A raw newline would end the command and allow injection of a new one.
 *
 * @param value - The text to place after `::`.
 * @returns The value with `%`, CR, and LF percent-encoded.
 */
function escapeData(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/**
 * Escape a workflow-command property value (e.g. `title=...`): data encoding plus `:` and `,`, which
 * otherwise delimit properties.
 *
 * @param value - The property value to encode.
 * @returns The value with data characters plus `:` and `,` percent-encoded.
 */
function escapeProperty(value) {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/**
 * Build one `::error::` workflow command. The title sits in a command property and the code and
 * message in the data segment, so each half is encoded for the position it occupies.
 *
 * @param title - The annotation title, shown as the heading in the Actions UI.
 * @param code - The structured error code, bracketed in front of the message.
 * @param message - The human-readable error message.
 * @returns The complete workflow-command line, without a trailing newline.
 */
function errorAnnotation(title, code, message) {
  return `::error title=${escapeProperty(title)}::${escapeData(`[${code}] ${message}`)}`;
}

/**
 * Parse the CLI's stdout into a RunSummary. Empty, blank, or unparseable input returns `null` rather
 * than throwing, since a whole-run error leaves stdout empty.
 *
 * @param stdout - The CLI's captured stdout (the --json RunSummary, or empty on a whole-run error).
 * @returns The parsed RunSummary, or `null` when there is no usable summary.
 */
export function parseSummaryJson(stdout) {
  const trimmed = String(stdout ?? "").trim();
  if (trimmed === "") {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Pull `{ code, message }` out of the CLI's stderr line "verbatra: error [CODE] message". The
 * message is matched with `.*`, which stops at the newline, so trailing stderr noise printed after
 * the error line is not folded into the extracted message.
 *
 * @param stderrText - The CLI's captured stderr.
 * @returns The extracted `{ code, message }`, or `null` when no error line is present.
 */
export function extractCliError(stderrText) {
  const match = String(stderrText ?? "").match(/error \[([^\]]+)\] (.*)/);
  if (match === null) {
    return null;
  }
  return { code: match[1], message: match[2].trim() };
}

/**
 * Exit code used when the `exit_code` output wiring itself is broken (missing or non-numeric), so a
 * broken wire-up fails the job loudly instead of defaulting to a false success.
 */
export const WIRING_FAILURE_EXIT_CODE = 2;

/**
 * Resolve the raw `exit_code` action-output argument into a numeric exit code. A missing or
 * non-numeric value means the wiring that carries the CLI's exit code (a step id, an output name)
 * is broken, not that the CLI exited 0; defaulting that case to 0 would let a broken wire-up report
 * success with an empty summary. It defaults to {@link WIRING_FAILURE_EXIT_CODE} instead.
 *
 * @param exitCodeArg - The raw `exit_code` argument (a string, or undefined when not passed).
 * @returns The parsed exit code, or `WIRING_FAILURE_EXIT_CODE` when it is missing or not a number.
 */
export function resolveExitCode(exitCodeArg) {
  const parsed = Number.parseInt(exitCodeArg ?? "", 10);
  return Number.isNaN(parsed) ? WIRING_FAILURE_EXIT_CODE : parsed;
}

/**
 * Render one locale as a row of the job-summary counts table. The column order here has to stay in
 * step with the header and separator built in `summaryMarkdown`; only the "failed" status is
 * reported as a failure, every other status reads as "ok".
 *
 * @param locale - One locale entry of the RunSummary.
 * @returns The markdown table row for that locale.
 */
function countsRow(locale) {
  const status = locale.status === "failed" ? "failed" : "ok";
  return `| ${locale.locale} | ${status} | ${locale.translated.length} | ${locale.unchanged.length} | ${locale.orphaned.length} | ${locale.invalidIcuSource.length} | ${locale.integrityMismatches.length} | ${locale.providerFailures.length} | ${locale.notices.length} |`;
}

/**
 * Build the job summary for a run that produced a parseable RunSummary: the per-locale counts
 * table, one aggregate line, and, when any locale failed, the failures listed with their structured
 * codes. A dry run is marked in both the heading and the aggregate line, because the table itself
 * looks identical to a real run that wrote files.
 *
 * @param summary - The parsed RunSummary.
 * @returns The markdown document, without a trailing newline.
 */
function summaryMarkdown(summary) {
  const heading = summary.dryRun
    ? "## verbatra translation summary (dry run)"
    : "## verbatra translation summary";
  const head =
    "| locale | status | translated | unchanged | orphaned | invalid ICU | integrity withheld | provider failures | notices |";
  const sep = "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const rows = summary.locales.map(countsRow);
  const aggregate = `${summary.locales.length} locales: ${summary.succeeded.length} succeeded, ${summary.failed.length} failed${
    summary.dryRun ? " (dry run: nothing written)" : ""
  }`;
  const lines = [heading, "", head, sep, ...rows, "", aggregate];

  const failedLocales = summary.locales.filter((locale) => locale.status === "failed");
  if (failedLocales.length > 0) {
    lines.push("", "Failed locales:");
    for (const locale of failedLocales) {
      const code = locale.error?.code ?? "LOCALE_FAILED";
      const message = locale.error?.message ?? "locale failed";
      lines.push(`- ${locale.locale}: [${code}] ${message}`);
    }
  }
  return lines.join("\n");
}

/**
 * Build the single annotation for a run that produced no usable summary. The structured code and
 * message from stderr are preferred, then raw stderr, then a generic message naming the exit code,
 * so the annotation still says something useful when the CLI died before it could report anything
 * structured.
 *
 * @param exitCode - The CLI's exit code.
 * @param stderrText - The CLI's captured stderr.
 * @returns The workflow-command line for the whole-run failure.
 */
function wholeRunAnnotation(exitCode, stderrText) {
  const cliError = extractCliError(stderrText);
  const code = cliError?.code ?? "VERBATRA_FAILED";
  const message =
    cliError?.message ??
    (String(stderrText ?? "").trim() || `The verbatra run failed (exit ${exitCode}).`);
  return errorAnnotation("verbatra", code, message);
}

/**
 * Build the job summary for a run that produced no usable summary, using the same fallback order as
 * the matching annotation. A summary is written even on a whole-run failure, so the job page never
 * shows an empty summary next to a red run.
 *
 * @param exitCode - The CLI's exit code.
 * @param stderrText - The CLI's captured stderr.
 * @returns The markdown document, without a trailing newline.
 */
function wholeRunMarkdown(exitCode, stderrText) {
  const cliError = extractCliError(stderrText);
  const detail = cliError
    ? `[${cliError.code}] ${cliError.message}`
    : String(stderrText ?? "").trim() || `The run could not complete (exit ${exitCode}).`;
  return [
    "## verbatra run failed",
    "",
    `The verbatra run could not complete (exit ${exitCode}).`,
    "",
    detail,
  ].join("\n");
}

/**
 * Build the report from the parsed summary (or null) and the CLI's exit code. exitStatus mirrors
 * exitCode exactly: the action consumes the CLI's contract and never re-derives failure from the
 * summary.
 *
 * @param summary - The parsed RunSummary, or `null` when there is no usable summary.
 * @param exitCode - The CLI's exit code, propagated verbatim to `exitStatus`.
 * @param stderrText - The CLI's captured stderr, used for the whole-run failure annotation.
 * @returns `{ annotations, summary, exitStatus }`: annotation lines, job-summary markdown, and exit status.
 */
export function buildReport(summary, exitCode, stderrText = "") {
  const exitStatus = exitCode;

  if (summary === null) {
    const annotations = exitCode !== 0 ? [wholeRunAnnotation(exitCode, stderrText)] : [];
    return { annotations, summary: wholeRunMarkdown(exitCode, stderrText), exitStatus };
  }

  const annotations =
    exitCode === 1
      ? summary.locales
          .filter((locale) => locale.status === "failed")
          .map((locale) =>
            errorAnnotation(
              `verbatra: ${locale.locale}`,
              locale.error?.code ?? "LOCALE_FAILED",
              locale.error?.message ?? "locale failed",
            ),
          )
      : [];
  return { annotations, summary: summaryMarkdown(summary), exitStatus };
}
