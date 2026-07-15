import type { AdapterRegistry } from "@verbatra/format-adapters";
import {
  DEFAULT_BUDGET_BEHAVIOR,
  DEFAULT_MAX_BATCH_SIZE,
  type VerbatraConfig,
} from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockFileLocale,
} from "../lock/lock-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { type CreateProvider, selectProvider } from "../selection/select-provider.js";
import { createBudgetTracker, toBudgetSummary } from "./budget.js";
import { failureSummary, partition } from "./locale-failure.js";
import { type LocaleRunParams, runLocale } from "./locale-run.js";
import { readSource } from "./source.js";
import type { LocaleSummary, RunSummary } from "./summary.js";
import { combineUsage } from "./usage.js";

/** Everything the one-shot run needs: the validated config and where/how to run it. */
export interface TranslateInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to the current working directory. */
  readonly cwd?: string;
  /** When true, read + diff + report only: the provider is never constructed or called and nothing is written. */
  readonly dryRun?: boolean;
  /**
   * When true, remove orphaned keys (target keys absent from source) from the written file and the lock.
   * Off by default. When set, takes precedence over the config's `prune` option for this run; when unset,
   * the config's `prune` applies. Only `diff.orphaned` keys are ever removed; no other key is touched.
   */
  readonly prune?: boolean;
  /**
   * When true, synthesize the CLDR plural forms a richer target language requires but the source lacks
   * (i18next-JSON + LLM providers only; every other case falls back to the existing warning). Off by
   * default. When set, takes precedence over the config's `generatePlurals` option for this run; when
   * unset, the config's `generatePlurals` applies.
   */
  readonly generatePlurals?: boolean;
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
 * underlying provider/adapter code, or `"LOCALE_FAILED"` as a fallback), not necessarily an
 * {@link SdkErrorCode}. DeepL notices, integrity mismatches, and invalid-ICU source keys likewise
 * surface on each `LocaleSummary`, never as throws.
 *
 * @param input - The validated config and run options (cwd, dryRun, prune, generatePlurals).
 * @param deps - Optional composition seams (registry, provider builder, file system) for tests.
 * @returns A {@link RunSummary}: the per-locale {@link LocaleSummary}s and the succeeded/failed locale lists.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`: no adapter is registered for the configured format.
 * @throws {@link SdkError} `PROVIDER_CONSTRUCTION_FAILED`: the provider factory threw (this wraps the
 *   provider's own error, including a missing `*_API_KEY` reported as `MISSING_API_KEY`); only on a
 *   non-dry-run, since dry-run never constructs the provider.
 * @throws {@link SdkError} `SOURCE_UNREADABLE`: the source locale file does not exist.
 * @throws {@link SdkError} `SOURCE_INVALID`: the source locale file could not be read or parsed (wraps the
 *   adapter read error).
 * @throws {@link SdkError} `LOCK_FILE_INVALID`: the lock-file is present but corrupt or oversized.
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
  const prune = input.prune ?? config.prune ?? false;
  const generatePlurals = input.generatePlurals ?? config.generatePlurals ?? false;
  const maxBatchSize = config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  const fs = deps.fs ?? defaultFs;
  // A fresh tracker per translate() invocation: the ceiling is per-run, not cumulative across watch cycles.
  const budget = createBudgetTracker(
    config.maxTokens,
    config.budgetBehavior ?? DEFAULT_BUDGET_BEHAVIOR,
  );

  const adapter = selectAdapter(config.format, deps.adapterRegistry);
  const provider = dryRun ? undefined : selectProvider(config.provider, deps.createProvider);

  const source = await readSource(config, cwd, fs, adapter);
  // Read once for each locale's diff baseline; the actual write-back for an accepted run goes
  // through updateLockFileLocale below, which re-reads fresh immediately before writing so a
  // concurrent writer (a Studio retranslateEntry call, another CLI run, or a workbook import) never
  // has its own update to a different locale, or a different key in the same locale, silently
  // discarded by a blind overwrite of this stale snapshot.
  const lock = await readLockFile(lockFilePath(cwd), fs);

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
        prune,
        generatePlurals,
        maxBatchSize,
        fs,
        budget,
      };
      const { summary, lockEntries } = await runLocale(params);
      if (!dryRun) {
        await updateLockFileLocale(cwd, fs, targetLocale, {
          mode: "replace",
          entries: lockEntries,
        });
      }
      summaries.push(summary);
    } catch (error) {
      summaries.push(failureSummary(targetLocale, error));
    }
  }

  const { succeeded, failed } = partition(summaries);
  const usage = summaries.reduce<ReturnType<typeof combineUsage>>(
    (total, summary) => combineUsage(total, summary.usage),
    undefined,
  );
  const budgetSummary = toBudgetSummary(budget);
  return {
    dryRun,
    locales: summaries,
    succeeded,
    failed,
    ...(usage !== undefined ? { usage } : {}),
    ...(budgetSummary !== undefined ? { budget: budgetSummary } : {}),
  };
}
