// Pure core for the verbatra GitHub Action: turn the CLI's --json RunSummary and exit code into
// GitHub annotations, a job-summary markdown, and the exit status. No I/O lives here (annotate.mjs
// does the reading/writing), so this is unit-testable without an Actions runner.
//
// The build result is the CLI's exit code, copied verbatim (exitStatus = exitCode), never re-derived
// from the summary. The parsed JSON is used only for annotation/summary CONTENT.

/**
 * Escape a workflow-command DATA segment (the message after `::`). This is the output-side
 * injection boundary: a value (CLI message, locale name) is encoded so it cannot break out of the
 * `::error::` command. A raw newline would end the command and let crafted text inject a new one.
 *
 * @param value - The text to place after `::`.
 * @returns The value with `%`, CR, and LF percent-encoded.
 */
function escapeData(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/**
 * Escape a workflow-command PROPERTY value (e.g. `title=...`): data encoding plus `:` and `,`, which
 * otherwise delimit properties, so a crafted value cannot forge extra annotation properties.
 *
 * @param value - The property value to encode.
 * @returns The value with data characters plus `:` and `,` percent-encoded.
 */
function escapeProperty(value) {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/** One GitHub error annotation line. */
function errorAnnotation(title, code, message) {
  return `::error title=${escapeProperty(title)}::${escapeData(`[${code}] ${message}`)}`;
}

/**
 * Parse the CLI's stdout into a RunSummary, or null. Under --json the CLI prints either the summary
 * JSON or nothing (a whole-run error leaves stdout empty), so empty/blank -> null and never a throw;
 * unparseable output is also treated as "no summary" rather than crashing the entry.
 *
 * Non-throwing by contract: empty, blank, or unparseable input returns `null`, never an exception.
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
 * Pull `{ code, message }` out of the CLI's stderr line "verbatra: error [CODE] message".
 *
 * Non-throwing by contract: returns `null` when the line is absent (no match), never an exception.
 *
 * @param stderrText - The CLI's captured stderr.
 * @returns The extracted `{ code, message }`, or `null` when no error line is present.
 */
export function extractCliError(stderrText) {
  // Match only the CLI's single error line (.* stops at the newline), so trailing stderr noise after
  // the "error [CODE] message" line is never folded into the annotation message.
  const match = String(stderrText ?? "").match(/error \[([^\]]+)\] (.*)/);
  if (match === null) {
    return null;
  }
  return { code: match[1], message: match[2].trim() };
}

/** One job-summary table row for a locale: status and the per-category counts. */
function countsRow(locale) {
  const status = locale.status === "failed" ? "failed" : "ok";
  return `| ${locale.locale} | ${status} | ${locale.translated.length} | ${locale.unchanged.length} | ${locale.orphaned.length} | ${locale.invalidIcuSource.length} | ${locale.integrityMismatches.length} | ${locale.notices.length} |`;
}

/** The job-summary markdown for a successful run: the counts table plus a failed-locales list. */
function summaryMarkdown(summary) {
  const heading = summary.dryRun
    ? "## verbatra translation summary (dry run)"
    : "## verbatra translation summary";
  const head =
    "| locale | status | translated | unchanged | orphaned | invalid ICU | integrity withheld | notices |";
  const sep = "| --- | --- | --- | --- | --- | --- | --- | --- |";
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

/** The single error annotation for a whole-run failure, from the CLI's stderr error line or a fallback. */
function wholeRunAnnotation(exitCode, stderrText) {
  const cliError = extractCliError(stderrText);
  const code = cliError?.code ?? "VERBATRA_FAILED";
  const message =
    cliError?.message ??
    (String(stderrText ?? "").trim() || `The verbatra run failed (exit ${exitCode}).`);
  return errorAnnotation("verbatra", code, message);
}

/** The job-summary markdown for a whole-run failure: a heading plus the error detail. */
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
 * Build the report from the parsed summary (or null) and the CLI's exit code.
 * exitStatus mirrors exitCode exactly. The action consumes the CLI's contract, it does not re-derive
 * failure. Annotations: whole-run failure (no summary, non-zero exit) -> one annotation from stderr;
 * per-locale failure (exit 1) -> one per failed locale; otherwise none.
 *
 * @param summary - The parsed RunSummary, or `null` when there is no usable summary.
 * @param exitCode - The CLI's exit code, propagated verbatim to `exitStatus`.
 * @param stderrText - The CLI's captured stderr, used for the whole-run failure annotation.
 * @returns `{ annotations, summary, exitStatus }`: the annotation lines, the job-summary markdown, and
 *   the exit status (always equal to `exitCode`).
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
