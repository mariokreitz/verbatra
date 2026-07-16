import type { TranslationProvider } from "@verbatra/ai-providers";
import type { AdapterRegistry, FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import {
  DEFAULT_BUDGET_BEHAVIOR,
  DEFAULT_MAX_BATCH_SIZE,
  type VerbatraConfig,
} from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { withLocaleWriteLock } from "../lock/locale-write-lock.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockFileLocale,
} from "../lock/lock-file.js";
import type { LockFile } from "../lock/types.js";
import {
  buildRunStatusFile,
  runStatusFilePath,
  writeRunStatusFile,
} from "../run-status/run-status-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { type CreateProvider, selectProvider } from "../selection/select-provider.js";
import type { BudgetTracker } from "./budget.js";
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

/** Everything one locale's run needs that does not vary by locale or by baseline. */
interface LocaleRunContext {
  readonly source: ReadResult;
  readonly adapter: FormatAdapter;
  readonly provider: TranslationProvider | undefined;
  readonly cwd: string;
  readonly config: VerbatraConfig;
  readonly prune: boolean;
  readonly generatePlurals: boolean;
  readonly maxBatchSize: number;
  readonly fs: SdkFs;
  readonly budget: BudgetTracker;
}

function buildLocaleRunParams(
  context: LocaleRunContext,
  targetLocale: string,
  baseline: ReadonlyMap<string, string>,
): LocaleRunParams {
  return {
    source: context.source.resource,
    sourceInvalidIcuKeys: context.source.invalidIcuKeys,
    baseline,
    adapter: context.adapter,
    provider: context.provider,
    cwd: context.cwd,
    filesPattern: context.config.files.pattern,
    sourceLocale: context.config.sourceLocale,
    targetLocale,
    format: context.config.format,
    glossary: context.config.glossary,
    tone: context.config.tone,
    prune: context.prune,
    generatePlurals: context.generatePlurals,
    maxBatchSize: context.maxBatchSize,
    fs: context.fs,
    budget: context.budget,
  };
}

/**
 * Dry-run path for one locale: the baseline comes from the single, pre-loop lock read `translate`
 * takes for the whole dry run (see its own call site). A dry run never calls `adapter.write` or
 * `updateLockFileLocale`, so there is nothing to protect and no reason to pay lock-acquire latency.
 */
async function runDryLocale(
  context: LocaleRunContext,
  targetLocale: string,
  lock: LockFile,
): Promise<LocaleSummary> {
  const params = buildLocaleRunParams(context, targetLocale, baselineFor(lock, targetLocale));
  return (await runLocale(params)).summary;
}

/**
 * Live (non-dry-run) path for one locale: the lock file is read fresh from disk once this
 * locale's write lock is actually held, not from a snapshot taken before the loop started. A
 * second concurrent `translate()` call for the same locale (another CLI process, or two
 * overlapping Studio actions) blocks on the real lock until the first releases, then re-reads a
 * lock file that already reflects the first call's write, so it diffs against a clean baseline
 * instead of a stale one and never re-sends an already-translated key to the provider. See the
 * lock-file-read relocation this function embodies: previously `translate` read the lock exactly
 * once before this loop, which let two concurrent calls both diff against the same stale snapshot
 * and both pay for the same provider call.
 */
async function runLiveLocale(
  context: LocaleRunContext,
  targetLocale: string,
): Promise<LocaleSummary> {
  return withLocaleWriteLock(context.cwd, targetLocale, context.fs, async () => {
    const lock = await readLockFile(lockFilePath(context.cwd), context.fs);
    const params = buildLocaleRunParams(context, targetLocale, baselineFor(lock, targetLocale));
    const result = await runLocale(params);
    await updateLockFileLocale(context.cwd, context.fs, targetLocale, {
      mode: "replace",
      entries: result.lockEntries,
    });
    return result.summary;
  });
}

/**
 * Runs one locale, isolating a per-locale failure as a `failed` summary instead of aborting the
 * run. `LOCK_FILE_INVALID` is the one exception, re-thrown rather than isolated: the live path now
 * reads the lock file inside each locale's own critical section (see `runLiveLocale`), but a
 * corrupt lock file is a whole-project condition, the same physical file every locale shares, not
 * a per-locale one, matching `translate()`'s own documented contract (it lists a corrupt lock-file
 * alongside its other whole-run failures) and every read-only flow function's own `LOCK_FILE_INVALID`
 * behavior (`check`, `diff`, `keyIntegrity`, `lockState`).
 */
async function runOneLocale(
  targetLocale: string,
  run: () => Promise<LocaleSummary>,
): Promise<LocaleSummary> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof SdkError && error.code === "LOCK_FILE_INVALID") {
      throw error;
    }
    return failureSummary(targetLocale, error);
  }
}

async function runAllLocalesDry(
  context: LocaleRunContext,
  targetLocales: readonly string[],
): Promise<LocaleSummary[]> {
  const lock = await readLockFile(lockFilePath(context.cwd), context.fs);
  const summaries: LocaleSummary[] = [];
  for (const targetLocale of targetLocales) {
    summaries.push(
      await runOneLocale(targetLocale, () => runDryLocale(context, targetLocale, lock)),
    );
  }
  return summaries;
}

async function runAllLocalesLive(
  context: LocaleRunContext,
  targetLocales: readonly string[],
): Promise<LocaleSummary[]> {
  const summaries: LocaleSummary[] = [];
  for (const targetLocale of targetLocales) {
    summaries.push(await runOneLocale(targetLocale, () => runLiveLocale(context, targetLocale)));
  }
  return summaries;
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
  const context: LocaleRunContext = {
    source,
    adapter,
    provider,
    cwd,
    config,
    prune,
    generatePlurals,
    maxBatchSize,
    fs,
    budget,
  };

  // Dry-run reads the lock once, outside any lock, and reuses that one snapshot for every
  // locale: a dry run never writes, so there is nothing to serialize against and no
  // staleness-vs-a-write to protect. A live run instead re-reads the lock fresh inside each
  // locale's own write lock (see runLiveLocale), so two concurrent live calls never both diff
  // against the same stale pre-loop snapshot; see runLiveLocale's own doc comment for why.
  const summaries = dryRun
    ? await runAllLocalesDry(context, config.targetLocales)
    : await runAllLocalesLive(context, config.targetLocales);

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
