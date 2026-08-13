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

const SETTLE_TIMEOUT_MS = 5000;

const MAX_STREAM_CHARS = 4000;

const REDACTION = "[redacted]";

const MIN_SECRET_LENGTH = 8;

const SECRET_ENV_NAME_PATTERN = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i;

const SECRET_VALUE_PATTERNS: RegExp[] = [/AIza[0-9A-Za-z_-]{10,}/g, /sk-[A-Za-z0-9_-]{16,}/g];

let recorded: RecordedRun[] = [];

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

export function resetRecordedRuns(): void {
  recorded = [];
}

export function recordRun(label: string, output: RecordedProcessOutput): void {
  recorded.push({ label, settle: () => Promise.resolve(output) });
}

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
