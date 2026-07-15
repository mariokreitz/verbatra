import type { AdapterRegistry } from "@verbatra/format-adapters";
import {
  DEFAULT_BUDGET_BEHAVIOR,
  DEFAULT_MAX_BATCH_SIZE,
  type VerbatraConfig,
} from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { withLocaleWriteLock } from "../lock/locale-write-lock.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockFileLocale,
} from "../lock/lock-file.js";
import {
  buildRunStatusFile,
  runStatusFilePath,
  writeRunStatusFile,
} from "../run-status/run-status-file.js";
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
 * On a non-dry-run that reaches the end of the loop, the run's review-flag and token/usage data is
 * also written to `.verbatra-local/run-status.json` (readable back through {@link runStatus}). This
 * write is best-effort: any failure is caught and swallowed, never re-thrown and never reflected on
 * the returned {@link RunSummary}.
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
/**
 * Persist the run's review-flag and token/usage snapshot to `.verbatra-local/run-status.json`, skipped
 * on dry-run for the same reason the lock-file write is skipped (dry-run never populates `needsReview`
 * or `usage`, so writing would clobber a real prior run's snapshot with an empty one). Best-effort by
 * design (unlike the lock-file write): any failure, including the directory not being creatable, is
 * caught and swallowed here so it never fails the run or reaches the caller. Studio already tolerates a
 * stale or absent run-status file.
 */
async function recordRunStatus(
  cwd: string,
  dryRun: boolean,
  summary: RunSummary,
  fs: SdkFs,
): Promise<void> {
  if (dryRun) {
    return;
  }
  try {
    await writeRunStatusFile(runStatusFilePath(cwd), buildRunStatusFile(summary), fs);
  } catch {
    // Swallowed on purpose; see the doc comment above.
  }
}

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
  // Read once for each locale's diff baseline. Each locale's own run-and-lock-update step below
  // holds that locale's withLocaleWriteLock for its whole critical section, so a concurrent writer
  // (a Studio retranslateEntry call, another CLI run, or a workbook import) touching that same
  // locale can never interleave with it; a different locale is never blocked by this one.
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
      let summary: LocaleSummary;
      if (dryRun) {
        // A dry run never calls adapter.write or updateLockFileLocale, so there is nothing to
        // protect and no reason to pay lock-acquire latency.
        summary = (await runLocale(params)).summary;
      } else {
        summary = await withLocaleWriteLock(cwd, targetLocale, fs, async () => {
          const result = await runLocale(params);
          await updateLockFileLocale(cwd, fs, targetLocale, {
            mode: "replace",
            entries: result.lockEntries,
          });
          return result.summary;
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
  const summary: RunSummary = {
    dryRun,
    locales: summaries,
    succeeded,
    failed,
    ...(usage !== undefined ? { usage } : {}),
    ...(budgetSummary !== undefined ? { budget: budgetSummary } : {}),
  };

  await recordRunStatus(cwd, dryRun, summary, fs);

  return summary;
}
