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

/** Everything the one-shot run needs: the validated config and where/how to run it. */
export interface TranslateInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to the current working directory. */
  readonly cwd?: string;
  /** When true, read + diff + report only: the provider is never constructed or called and nothing is written. */
  readonly dryRun?: boolean;
}

/** Composition seam: inject a registry, a provider builder, and a file system for tests. */
export interface TranslateDeps {
  /** Adapter registry to resolve the format from; defaults to the built-in registry. */
  readonly adapterRegistry?: AdapterRegistry;
  /** Provider builder; defaults to constructing the configured provider (which reads its key from env). */
  readonly createProvider?: CreateProvider;
  /** File system for existence checks and the lock-file; defaults to the real file system. */
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
 *
 * A per-locale failure does NOT throw: it is recorded on that locale's {@link LocaleSummary} as
 * `status: "failed"` with a secret-free `{ code, message }`, where `code` is a preserved string (the
 * underlying provider/adapter code, or `"LOCALE_FAILED"` as a fallback) — not necessarily an
 * {@link SdkErrorCode}. DeepL notices, integrity mismatches, and invalid-ICU source keys likewise
 * surface on each `LocaleSummary`, never as throws.
 *
 * @param input - The validated config and run options (cwd, dryRun).
 * @param deps - Optional composition seams (registry, provider builder, file system) for tests.
 * @returns A {@link RunSummary}: the per-locale {@link LocaleSummary}s and the succeeded/failed locale lists.
 * @throws {@link SdkError} `UNKNOWN_FORMAT` — no adapter is registered for the configured format.
 * @throws {@link SdkError} `PROVIDER_CONSTRUCTION_FAILED` — the provider factory threw (this wraps the
 *   provider's own error, including a missing `*_API_KEY` reported as `MISSING_API_KEY`); only on a
 *   non-dry-run, since dry-run never constructs the provider.
 * @throws {@link SdkError} `SOURCE_UNREADABLE` — the source locale file does not exist.
 * @throws {@link SdkError} `SOURCE_INVALID` — the source locale file could not be read or parsed (wraps the
 *   adapter read error).
 * @throws {@link SdkError} `LOCK_FILE_INVALID` — the lock-file is present but corrupt or oversized.
 * @example
 * ```ts
 * import { loadConfig, translate } from "@verbatra/sdk";
 *
 * // The provider reads its API key from the environment (e.g. ANTHROPIC_API_KEY); no key is passed here.
 * const config = await loadConfig();
 * const summary = await translate({ config });
 *
 * for (const locale of summary.locales) {
 *   if (locale.status === "failed") {
 *     // Surfaced, not thrown: code is a preserved string (LOCALE_FAILED is only the fallback).
 *     console.error(`${locale.locale}: ${locale.error?.code} ${locale.error?.message}`);
 *   } else {
 *     console.log(`${locale.locale}: ${locale.translated.length} translated, ${locale.notices.length} notices`);
 *   }
 * }
 *
 * // Preview only: no provider call, no writes.
 * const preview = await translate({ config, dryRun: true });
 * ```
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
