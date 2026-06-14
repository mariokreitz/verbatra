import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockLocale,
  writeLockFile,
} from "../lock/lock-file.js";
import { localeFilePath } from "../paths.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { type CreateProvider, selectProvider } from "../selection/select-provider.js";
import { type LocaleRunParams, runLocale } from "./locale-run.js";
import type { LocaleSummary, RunSummary } from "./summary.js";

export interface TranslateInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly dryRun?: boolean;
}

/** Composition seam: inject a registry, a provider builder, and a file system for tests. */
export interface TranslateDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly createProvider?: CreateProvider;
  readonly fs?: SdkFs;
}

function describeError(error: unknown): { code: string; message: string } {
  // Per-locale failures are Adapter/Provider errors (both secret-free), which carry a
  // string `code`; SdkError, also an Error with a `code`, is handled by the same branch.
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return { code: typeof code === "string" ? code : "LOCALE_FAILED", message: error.message };
  }
  return { code: "LOCALE_FAILED", message: String(error) };
}

function failureSummary(locale: string, error: unknown): LocaleSummary {
  return {
    locale,
    status: "failed",
    translated: [],
    unchanged: [],
    orphaned: [],
    invalidIcuSource: [],
    integrityMismatches: [],
    notices: [],
    error: describeError(error),
  };
}

async function readSource(
  config: VerbatraConfig,
  cwd: string,
  fs: SdkFs,
  adapter: ReturnType<typeof selectAdapter>,
) {
  const sourcePath = localeFilePath(cwd, config.files.pattern, config.sourceLocale);
  if (!(await fs.fileExists(sourcePath))) {
    throw new SdkError(
      "SOURCE_UNREADABLE",
      `The source locale file was not found at ${sourcePath}.`,
    );
  }
  try {
    return await adapter.read(sourcePath, config.sourceLocale);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SdkError(
      "SOURCE_INVALID",
      `The source locale file at ${sourcePath} could not be read: ${detail}`,
    );
  }
}

/**
 * The one-shot end-to-end translate flow. Whole-run failures (config already validated
 * by the caller, unknown format, provider construction, unreadable/invalid source,
 * corrupt lock-file) throw a structured SdkError. Per-locale failures are isolated: a
 * failing locale is reported and the run continues; the lock-file reflects exactly the
 * locales that succeeded. Dry-run reads + diffs + reports without constructing/calling
 * the provider and without writing any file or the lock-file.
 */
export async function translate(
  input: TranslateInput,
  deps: TranslateDeps = {},
): Promise<RunSummary> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const dryRun = input.dryRun ?? false;
  const fs = deps.fs ?? defaultFs;

  const adapter = selectAdapter(config.format, deps.adapterRegistry);
  const provider = dryRun ? undefined : selectProvider(config.provider, deps.createProvider);

  const source = await readSource(config, cwd, fs, adapter);
  const lockPath = lockFilePath(cwd);
  let lock = await readLockFile(lockPath, fs);

  const summaries: LocaleSummary[] = [];
  for (const targetLocale of config.targetLocales) {
    try {
      const params: LocaleRunParams = {
        source: source.resource,
        sourceInvalidIcuKeys: source.invalidIcuKeys,
        baseline: baselineFor(lock, targetLocale),
        adapter,
        provider,
        cwd,
        filesPattern: config.files.pattern,
        sourceLocale: config.sourceLocale,
        targetLocale,
        format: config.format,
        glossary: config.glossary,
        tone: config.tone,
        fs,
      };
      const { summary, lockEntries } = await runLocale(params);
      if (!dryRun) {
        lock = updateLockLocale(lock, targetLocale, lockEntries);
        await writeLockFile(lockPath, lock, fs);
      }
      summaries.push(summary);
    } catch (error) {
      summaries.push(failureSummary(targetLocale, error));
    }
  }

  return aggregate(dryRun, summaries);
}

function aggregate(dryRun: boolean, locales: readonly LocaleSummary[]): RunSummary {
  const succeeded = locales.filter((s) => s.status === "succeeded").map((s) => s.locale);
  const failed = locales.filter((s) => s.status === "failed").map((s) => s.locale);
  return { dryRun, locales, succeeded, failed };
}
