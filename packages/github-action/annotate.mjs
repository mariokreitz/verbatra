// Thin I/O entry for the verbatra GitHub Action. Reads the captured CLI stdout (RunSummary JSON) and
// stderr files plus the CLI exit code from argv, delegates to the pure core, then emits the GitHub
// annotations (::error:: workflow commands on stdout), appends the job summary to $GITHUB_STEP_SUMMARY,
// and exits with the build status. All side effects live here; the logic lives in report.mjs.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { buildReport, parseSummaryJson } from "./report.mjs";

const [summaryFile, errorFile, exitCodeArg] = process.argv.slice(2);

/** Read a UTF-8 file, or "" when the path is missing or absent (a missing capture file is not an error). */
const readOrEmpty = (path) => (path && existsSync(path) ? readFileSync(path, "utf8") : "");

const summary = parseSummaryJson(readOrEmpty(summaryFile));
const stderrText = readOrEmpty(errorFile);
const exitCode = Number.parseInt(exitCodeArg ?? "", 10);

const report = buildReport(summary, Number.isNaN(exitCode) ? 0 : exitCode, stderrText);

for (const annotation of report.annotations) {
  process.stdout.write(`${annotation}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.summary}\n`);
}

process.exit(report.exitStatus);
