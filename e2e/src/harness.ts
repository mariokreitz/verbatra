import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const e2eDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(e2eDir, ".tarballs.json");

export interface Tarballs {
  sdk: string;
  cli: string;
}

export async function readTarballs(): Promise<Tarballs> {
  return JSON.parse(await readFile(manifestPath, "utf8")) as Tarballs;
}

export interface Consumer {
  dir: string;
  bin: string;
}

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

export async function runVerbatra(
  consumer: Consumer,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<RunResult> {
  const result = await execa(consumer.bin, args, {
    cwd: options.cwd ?? consumer.dir,
    env: { ...process.env, ...options.env },
    reject: false,
  });
  return {
    exitCode: result.exitCode ?? null,
    signal: result.signal ?? null,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

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

export type Subprocess = ReturnType<typeof spawnVerbatra>;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export async function writeFileIn(
  dir: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const full = join(dir, relativePath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, contents);
}

export async function writeJsonIn(
  dir: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  await writeFileIn(dir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonIn<T = unknown>(dir: string, relativePath: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, relativePath), "utf8")) as T;
}

export interface ProviderEnv {
  id: "anthropic" | "openai" | "gemini" | "deepl";
  envVar: string;
  key: string;
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
