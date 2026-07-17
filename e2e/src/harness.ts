import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const e2eDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(e2eDir, ".tarballs.json");

/** Absolute paths to the packed `@verbatra/sdk` and `@verbatra/cli` tarballs. */
export interface Tarballs {
  sdk: string;
  cli: string;
}

/**
 * Reads the tarball manifest (`e2e/.tarballs.json`) written by the vitest global setup.
 *
 * @throws When global setup has not run and the manifest does not exist.
 */
export async function readTarballs(): Promise<Tarballs> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as Tarballs;
}

/** A throwaway npm project with the packed tarballs installed. */
export interface Consumer {
  /** The consumer project's root directory (a fresh temp directory). */
  dir: string;
  /** Absolute path to the installed `verbatra` binary in the consumer's `node_modules/.bin`. */
  bin: string;
}

/**
 * Creates a consumer project: a temp directory with a minimal package.json, then a real
 * `npm install` of the sdk and cli tarballs from the manifest. This is the "published package"
 * boundary the whole suite tests through.
 */
export async function makeConsumer(): Promise<Consumer> {
  const { sdk, cli } = await readTarballs();
  const dir = await mkdtemp(join(tmpdir(), "verbatra-e2e-consumer-"));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "verbatra-e2e-consumer", version: "0.0.0", private: true }, null, 2),
  );
  await execa("npm", ["install", "--no-audit", "--no-fund", "--no-package-lock", sdk, cli], {
    cwd: dir,
  });
  return { dir, bin: join(dir, "node_modules", ".bin", "verbatra") };
}

/** The outcome of one completed CLI run. */
export interface RunResult {
  /**
   * The process exit code, or `null` when the process never reported one (killed by a signal, or
   * failed to spawn). Never coerced to 0: a signal-killed run must not read as a successful one.
   */
  exitCode: number | null;
  /** The signal that terminated the process, or `null` when it exited normally. */
  signal: string | null;
  stdout: string;
  stderr: string;
}

/** Options for {@link runVerbatra}. */
export interface RunOptions {
  /** Working directory for the child process; defaults to the consumer's root. */
  cwd?: string;
  /** Extra environment variables merged over the current process environment. */
  env?: Record<string, string>;
  /**
   * Milliseconds to let the process run before force-killing it with SIGKILL. SIGKILL, unlike
   * SIGINT or SIGTERM, cannot be caught by the CLI's own shutdown handling, so this is the
   * deterministic way to force a real signal-death (the same shape a crash or an OOM kill
   * produces) through a helper that otherwise only awaits a process to its natural completion.
   */
  timeoutMs?: number;
}

/**
 * Runs the consumer's `verbatra` binary to completion and returns the outcome. Never throws on a
 * non-zero exit or a signal death (`reject: false`); assert on the returned {@link RunResult}
 * instead.
 *
 * @param consumer - The consumer project whose installed binary to run.
 * @param args - CLI arguments passed to the binary.
 * @param options - Working directory, environment overrides, and the optional kill timeout.
 */
export async function runVerbatra(
  consumer: Consumer,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const timeoutOptions =
    options.timeoutMs === undefined
      ? {}
      : { timeout: options.timeoutMs, killSignal: "SIGKILL" as const };
  const result = await execa(consumer.bin, args, {
    cwd: options.cwd ?? consumer.dir,
    env: { ...process.env, ...options.env },
    reject: false,
    ...timeoutOptions,
  });
  return {
    exitCode: result.exitCode ?? null,
    signal: result.signal ?? null,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Starts the consumer's `verbatra` binary without awaiting it, for long-running commands such as
 * `watch`. The returned subprocess exposes live stdio streams and `kill()`; awaiting it yields the
 * final result without throwing (`reject: false`).
 *
 * @param consumer - The consumer project whose installed binary to run.
 * @param args - CLI arguments passed to the binary.
 * @param options - Working directory and environment overrides.
 */
export function spawnVerbatra(
  consumer: Consumer,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
) {
  return execa(consumer.bin, args, {
    cwd: options.cwd ?? consumer.dir,
    env: { ...process.env, ...options.env },
    reject: false,
  });
}

/** The execa subprocess handle returned by {@link spawnVerbatra}. */
export type Subprocess = ReturnType<typeof spawnVerbatra>;

/** One line of `watch --json` NDJSON output; a subset of the SDK's `WatchRunResult`. */
export interface WatchRunResultJson {
  status: "succeeded" | "failed";
}

/**
 * Parses `watch --json` stdout into one record per non-empty NDJSON line.
 *
 * @throws When a non-empty line is not valid JSON.
 */
export function parseNdjsonLines(stdout: string): WatchRunResultJson[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as WatchRunResultJson);
}

/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls `predicate` every `intervalMs` until it returns true.
 *
 * @throws When the predicate is still false after `timeoutMs`.
 */
export async function pollUntil(
  predicate: () => Promise<boolean> | boolean,
  options: { timeoutMs: number; intervalMs: number },
): Promise<void> {
  const deadline = Date.now() + options.timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await delay(options.intervalMs);
  }
  throw new Error(`pollUntil timed out after ${options.timeoutMs}ms`);
}

/** Writes `contents` to `dir/relativePath`, creating parent directories as needed. */
export async function writeFileIn(
  dir: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const full = join(dir, relativePath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, contents);
}

/** Writes `value` as pretty-printed JSON (with a trailing newline) to `dir/relativePath`. */
export async function writeJsonIn(
  dir: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  await writeFileIn(dir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

/** Reads and parses the JSON file at `dir/relativePath`. */
export async function readJsonIn<T = unknown>(dir: string, relativePath: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, relativePath), "utf8")) as T;
}

/** A live provider selected from the environment, for the tests that call a real API. */
export interface ProviderEnv {
  id: "anthropic" | "openai" | "gemini" | "deepl";
  /** The environment variable the CLI reads the key from (for example `GEMINI_API_KEY`). */
  envVar: string;
  /** The API key value taken from that variable. */
  key: string;
  /** The model to scaffold into the test config; absent for DeepL. */
  model?: string;
}

const PROVIDER_ENV_VARS: Record<ProviderEnv["id"], string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepl: "DEEPL_API_KEY",
};

const SCAFFOLD_MODELS: Partial<Record<ProviderEnv["id"], string>> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.4-mini",
  gemini: "gemini-2.5-flash",
};

/**
 * Selects the live provider from the environment. `E2E_PROVIDER` picks the provider id (default
 * "gemini"); returns `null` when the id is unknown or the provider's API key variable is unset,
 * which the live suites use to skip themselves.
 */
export function providerFromEnv(): ProviderEnv | null {
  const id = (process.env.E2E_PROVIDER ?? "gemini") as ProviderEnv["id"];
  const envVar = PROVIDER_ENV_VARS[id];
  if (!envVar) {
    return null;
  }
  const key = process.env[envVar];
  if (!key) {
    return null;
  }
  const model = SCAFFOLD_MODELS[id];
  return model ? { id, envVar, key, model } : { id, envVar, key };
}

/**
 * Renders the `provider` block of a scaffolded `verbatra.config.ts` for the given provider,
 * falling back to a default model when none is given.
 */
export function providerConfigBlock(provider: { id: ProviderEnv["id"]; model?: string }): string {
  switch (provider.id) {
    case "anthropic":
      return `{ id: "anthropic", options: { model: ${JSON.stringify(provider.model ?? "claude-sonnet-4-6")}, maxTokens: 4096 } }`;
    case "openai":
      return `{ id: "openai", options: { model: ${JSON.stringify(provider.model ?? "gpt-5.4-mini")}, maxOutputTokens: 4096 } }`;
    case "gemini":
      return `{ id: "gemini", options: { model: ${JSON.stringify(provider.model ?? "gemini-2.5-flash")}, maxOutputTokens: 4096 } }`;
    case "deepl":
      return `{ id: "deepl", options: {} }`;
  }
}
