/**
 * I/O entry point of the verbatra GitHub Action, run by the "Annotate and summarize" step in
 * action.yml with three arguments: the file holding the CLI's captured stdout, the file holding its
 * captured stderr, and the exit code the run step recorded as an output. It reads those, delegates
 * every decision to the pure core in report.mjs, writes the annotations to stdout for the Actions
 * log parser, appends the job summary to GITHUB_STEP_SUMMARY, and exits with the CLI's own code.
 *
 * Failing the job is this script's responsibility, and it happens last, once the annotations and
 * the summary have been emitted. The step that runs the CLI deliberately swallows the non-zero exit
 * and passes it along as an output instead: a composite step that exits non-zero aborts the action,
 * which would skip annotation entirely.
 *
 * A missing argument or a missing file reads as empty rather than as an error, since a run that
 * died before writing anything must still produce a whole-run annotation instead of crashing the
 * reporter.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { buildReport, parseSummaryJson, resolveExitCode } from "./report.mjs";

const [summaryFile, errorFile, exitCodeArg] = process.argv.slice(2);

/**
 * Read one of the captured files, treating an absent argument or a missing file as empty output.
 *
 * @param path - Path to the captured file, or undefined when the argument was not passed.
 * @returns The file contents, or an empty string.
 */
const readOrEmpty = (path) => (path && existsSync(path) ? readFileSync(path, "utf8") : "");

const summary = parseSummaryJson(readOrEmpty(summaryFile));
const stderrText = readOrEmpty(errorFile);

const report = buildReport(summary, resolveExitCode(exitCodeArg), stderrText);

for (const annotation of report.annotations) {
  process.stdout.write(`${annotation}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.summary}\n`);
}

process.exit(report.exitStatus);
