// I/O entry for the verbatra GitHub Action: reads the captured CLI stdout, stderr, and exit code,
// delegates to the pure core in report.mjs, emits annotations, appends the job summary, and exits.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { buildReport, parseSummaryJson } from "./report.mjs";

const [summaryFile, errorFile, exitCodeArg] = process.argv.slice(2);

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
