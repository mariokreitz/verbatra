/**
 * Failure diagnostics for the e2e suite.
 *
 * Every CLI run the harness starts is registered here. Nothing is read, resolved, or printed
 * unless the current test fails, so a green run stays silent and no extra work (and no extra
 * provider call) happens on the happy path. The wiring that turns a failed test into printed
 * output lives in `report-failures.ts`, which vitest loads as a setup file.
 *
 * This module deliberately knows nothing about vitest or execa: it takes plain values and
 * callbacks, which keeps it importable from the harness without a cycle and unit-testable on
 * its own.
 */

/** The buffered outcome of one CLI run, as printed in a failure report. */
export interface RecordedProcessOutput {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
}

interface RecordedRun {
  label: string;
  settle: () => Promise<RecordedProcessOutput | undefined>;
}

/** Milliseconds to wait for a still-running subprocess before giving up on its output. */
const SETTLE_TIMEOUT_MS = 5000;

/** Characters kept per stream. The tail is kept because the failing error is printed last. */
const MAX_STREAM_CHARS = 4000;

/** The placeholder written in place of anything that looks like a credential. */
const REDACTION = "[redacted]";

/**
 * Values shorter than this are never treated as secrets. An empty value would otherwise turn
 * `replaceAll` into an insertion between every character, and short values ("1", "true") are
 * common enough that redacting them would corrupt the report.
 */
const MIN_SECRET_LENGTH = 8;

/**
 * Environment variable names whose values are treated as secrets. Every provider key variable
 * the harness reads (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPL_API_KEY`)
 * contains `KEY`, and the co-located test asserts that stays true; the rest of the pattern
 * covers the other credential-shaped variables a CI runner carries.
 */
const SECRET_ENV_NAME_PATTERN = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i;

/**
 * Shapes redacted on sight, independent of the environment. This is the belt to the environment
 * scan's braces: a key that reached the subprocess through a variable this process never saw is
 * still caught.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [/AIza[0-9A-Za-z_-]{10,}/g, /sk-[A-Za-z0-9_-]{16,}/g];

let recorded: RecordedRun[] = [];

/** True when `name` is treated as holding a secret value. */
export function isSecretEnvName(name: string): boolean {
  return SECRET_ENV_NAME_PATTERN.test(name);
}

function secretValues(): string[] {
  return Object.entries(process.env)
    .filter(([name]) => isSecretEnvName(name))
    .map(([, value]) => value)
    .filter(
      (value): value is string => typeof value === "string" && value.length >= MIN_SECRET_LENGTH,
    );
}

/**
 * Replaces every known credential in `text` with a placeholder. Applied to everything this module
 * prints, so the printer is safe on its own terms rather than by trusting the CLI never to emit a
 * key.
 */
export function redactSecrets(text: string): string {
  let safe = text;
  for (const secret of secretValues()) {
    safe = safe.replaceAll(secret, REDACTION);
  }
  for (const pattern of SECRET_VALUE_PATTERNS) {
    safe = safe.replace(pattern, REDACTION);
  }
  return safe;
}

/** Redacts, then keeps only the tail, so truncation can never slice a key into a visible prefix. */
function renderStream(text: string): string {
  const safe = redactSecrets(text);
  if (safe.length === 0) {
    return "<empty>";
  }
  if (safe.length <= MAX_STREAM_CHARS) {
    return safe;
  }
  const omitted = safe.length - MAX_STREAM_CHARS;
  return `[... ${omitted} earlier characters omitted]\n${safe.slice(-MAX_STREAM_CHARS)}`;
}

/** Renders one run as a labelled, redacted block ready to be written to the test log. */
export function formatRecordedOutput(label: string, output: RecordedProcessOutput): string {
  const header = `${redactSecrets(label)} (exit ${output.exitCode}, signal ${output.signal})`;
  return [
    `--- e2e captured output: ${header}`,
    "stdout:",
    renderStream(output.stdout),
    "stderr:",
    renderStream(output.stderr),
    "--- end e2e captured output",
  ].join("\n");
}

/** Forgets everything recorded so far. Called before each test. */
export function resetRecordedRuns(): void {
  recorded = [];
}

/** Records a run that has already completed and whose streams are final. */
export function recordRun(label: string, output: RecordedProcessOutput): void {
  recorded.push({ label, settle: () => Promise.resolve(output) });
}

/**
 * Records a run that may still be in flight. `settle` is invoked only when the test fails, and is
 * expected to stop the process and resolve with its buffered streams.
 */
export function recordPendingRun(
  label: string,
  settle: () => Promise<RecordedProcessOutput>,
): void {
  recorded.push({ label, settle });
}

function timeoutAfter(ms: number): Promise<undefined> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(undefined), ms).unref();
  });
}

async function settleSafely(run: RecordedRun): Promise<RecordedProcessOutput | undefined> {
  try {
    return await Promise.race([run.settle(), timeoutAfter(SETTLE_TIMEOUT_MS)]);
  } catch {
    return undefined;
  }
}

/**
 * Resolves every recorded run and renders it. Runs that neither completed nor could be stopped
 * within {@link SETTLE_TIMEOUT_MS} are reported as such rather than blocking the report.
 */
export async function collectFailureReport(): Promise<string[]> {
  const blocks: string[] = [];
  for (const run of recorded) {
    const output = await settleSafely(run);
    blocks.push(
      output === undefined
        ? `--- e2e captured output: ${redactSecrets(run.label)} (no output available)`
        : formatRecordedOutput(run.label, output),
    );
  }
  return blocks;
}
