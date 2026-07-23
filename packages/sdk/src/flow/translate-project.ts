import type { TranslationProvider } from "@verbatra/ai-providers";
import type { AdapterRegistry, FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import {
  DEFAULT_BUDGET_BEHAVIOR,
  DEFAULT_MAX_BATCH_SIZE,
  type VerbatraConfig,
} from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import {
  type LocaleWriteLockOptions,
  type LockWaitListener,
  withLocaleWriteLock,
} from "../lock/locale-write-lock.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockFileLocale,
} from "../lock/lock-file.js";
import type { LockFile } from "../lock/types.js";
import type { ProgressListener } from "../progress/types.js";
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
  /**
   * Called while a locale's write lock is blocked on another process holding it: once after the first
   * failed acquire (with the holder's pid/acquiredAt when the lock file is readable), then periodically
   * with the growing elapsed time. Never called for an uncontended run. The SDK writes no output; this
   * is the only wait-progress signal (the CLI renders its "still waiting" line from it).
   */
  readonly onLockWait?: LockWaitListener;
  /**
   * Called as the run advances: once per locale before it starts and once after it finishes, once
   * per provider sub-batch within a locale, and once when the whole locale loop ends. Never fires a
   * sub-batch event on a dry-run (no provider call is made). The SDK writes no output; this is the
   * only progress signal (the CLI renders it to stderr, keeping stdout byte-identical).
   *
   * Pairing is not guaranteed when the run throws: a whole-run failure (for example a corrupt
   * lock-file surfacing as `LOCK_FILE_INVALID`, which re-throws instead of being isolated per locale)
   * can emit a `locale-started` event with no matching `locale-finished`, and no `run-finished` at
   * all. A per-locale failure that is isolated (not re-thrown) still emits both, and is counted in
   * `run-finished`.
   */
  readonly onProgress?: ProgressListener;
  /**
   * Override how long a locale's write lock keeps retrying before failing with `LOCK_CONTENDED`, in
   * milliseconds. Defaults to the lock's own 10-minute default when unset (surfaced to the CLI as
   * `--lock-timeout`).
   */
  readonly lockAcquireTimeoutMs?: number;
  /**
   * How many target locales may run at once, a positive integer (surfaced to the CLI as
   * `--concurrency`). Defaults to 1, which runs locales strictly in sequence and is byte-identical
   * to a run with this option unset. A value below 1 or a non-integer is rejected with a whole-run
   * `CONCURRENCY_INVALID` error. On a live run, a value greater than 1 is rejected with a whole-run
   * `CONCURRENCY_BUDGET_CONFLICT` error when the config sets a `maxTokens` budget, because
   * concurrency would make the budget's stop guarantee nondeterministic; a dry run is exempt. The
   * per-locale write locks already isolate concurrent locales on disk, so no extra locking is added.
   */
  readonly concurrency?: number;
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
  } catch {}
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
  readonly onLockWait?: LockWaitListener;
  readonly onProgress?: ProgressListener;
  readonly lockAcquireTimeoutMs?: number;
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
    ...(context.onProgress !== undefined ? { onProgress: context.onProgress } : {}),
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
  const lockOptions: LocaleWriteLockOptions = {
    ...(context.onLockWait !== undefined ? { onWait: context.onLockWait } : {}),
    ...(context.lockAcquireTimeoutMs !== undefined
      ? { acquireTimeoutMs: context.lockAcquireTimeoutMs }
      : {}),
  };
  return withLocaleWriteLock(
    context.cwd,
    targetLocale,
    context.fs,
    async () => {
      const lock = await readLockFile(lockFilePath(context.cwd), context.fs);
      const params = buildLocaleRunParams(context, targetLocale, baselineFor(lock, targetLocale));
      const result = await runLocale(params);
      await updateLockFileLocale(context.cwd, context.fs, targetLocale, {
        mode: "replace",
        entries: result.lockEntries,
      });
      return result.summary;
    },
    lockOptions,
  );
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

/**
 * Runs one target locale at `localeIndex`: emits `locale-started`, runs it (isolating a per-locale
 * failure), stores its summary at `localeIndex` so the collected array stays in `targetLocales`
 * order regardless of completion order, then emits `locale-finished` with that locale's accepted-key
 * count. Sub-batch events, which require a provider call, are emitted deeper in `runLocale` and so
 * never fire on the dry path.
 */
async function runLocaleAt(
  context: LocaleRunContext,
  targetLocales: readonly string[],
  localeIndex: number,
  runOne: (targetLocale: string) => Promise<LocaleSummary>,
  results: (LocaleSummary | undefined)[],
): Promise<void> {
  const targetLocale = targetLocales[localeIndex];
  if (targetLocale === undefined) {
    return;
  }
  context.onProgress?.({
    type: "locale-started",
    locale: targetLocale,
    localeIndex,
    totalLocales: targetLocales.length,
  });
  const summary = await runOneLocale(targetLocale, () => runOne(targetLocale));
  results[localeIndex] = summary;
  context.onProgress?.({
    type: "locale-finished",
    locale: targetLocale,
    translated: summary.translated.length,
  });
}

/**
 * Runs the target locales through a bounded worker pool of width `concurrency`, collecting each
 * summary into its `targetLocales` slot so the returned array is always in source order, never
 * completion order. With `concurrency` 1 (the default) a single worker drains the locales strictly
 * in sequence, reproducing the serial behavior exactly: same event order, same summary order. Shared
 * by the dry and live paths. A locale index is claimed synchronously (no `await` between the read and
 * the increment), so two workers never claim the same locale.
 */
async function runLocalesWithProgress(
  context: LocaleRunContext,
  targetLocales: readonly string[],
  runOne: (targetLocale: string) => Promise<LocaleSummary>,
  concurrency: number,
): Promise<LocaleSummary[]> {
  const totalLocales = targetLocales.length;
  const results: (LocaleSummary | undefined)[] = new Array<LocaleSummary | undefined>(totalLocales);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < totalLocales) {
      const localeIndex = nextIndex;
      nextIndex += 1;
      await runLocaleAt(context, targetLocales, localeIndex, runOne, results);
    }
  }

  const workerCount = Math.min(concurrency, totalLocales);
  const workers: Promise<void>[] = [];
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results.filter((summary): summary is LocaleSummary => summary !== undefined);
}

async function runAllLocalesDry(
  context: LocaleRunContext,
  targetLocales: readonly string[],
  concurrency: number,
): Promise<LocaleSummary[]> {
  const lock = await readLockFile(lockFilePath(context.cwd), context.fs);
  return runLocalesWithProgress(
    context,
    targetLocales,
    (targetLocale) => runDryLocale(context, targetLocale, lock),
    concurrency,
  );
}

async function runAllLocalesLive(
  context: LocaleRunContext,
  targetLocales: readonly string[],
  concurrency: number,
): Promise<LocaleSummary[]> {
  return runLocalesWithProgress(
    context,
    targetLocales,
    (targetLocale) => runLiveLocale(context, targetLocale),
    concurrency,
  );
}

/**
 * Resolves and validates the run's locale-level concurrency. Unset means 1 (strictly serial,
 * byte-identical to the pre-pool behavior). Any other value must be an integer of at least 1; a
 * non-integer or a value below 1 is a whole-run `CONCURRENCY_INVALID` failure raised before any
 * locale runs.
 *
 * @throws {@link SdkError} `CONCURRENCY_INVALID`: `value` is defined but not an integer of at least 1.
 */
function resolveConcurrency(value: number | undefined): number {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new SdkError(
      "CONCURRENCY_INVALID",
      `The concurrency option must be an integer of at least 1, got ${value}.`,
    );
  }
  return value;
}

/**
 * Validates the requested concurrency and rejects the one combination the budget cannot honor: a
 * live run with concurrency greater than 1 while a `maxTokens` budget is configured. The refusal is
 * raised before any locale runs (and so before any provider call). A dry run is exempt: it
 * constructs no provider and no budget tracker, so concurrency cannot affect a budget it never
 * consults.
 *
 * @throws {@link SdkError} `CONCURRENCY_INVALID`: `value` is defined but not an integer of at least 1.
 * @throws {@link SdkError} `CONCURRENCY_BUDGET_CONFLICT`: a live run set concurrency greater than 1
 *   while `config.maxTokens` is set.
 */
function resolveRunConcurrency(
  value: number | undefined,
  dryRun: boolean,
  config: VerbatraConfig,
): number {
  const concurrency = resolveConcurrency(value);
  if (!dryRun && concurrency > 1 && config.maxTokens !== undefined) {
    throw new SdkError(
      "CONCURRENCY_BUDGET_CONFLICT",
      "A token budget (maxTokens) and concurrency greater than 1 cannot be combined on a live run: " +
        "concurrent locales would overshoot the budget nondeterministically. Set concurrency to 1, " +
        "remove maxTokens, or use --dry-run.",
    );
  }
  return concurrency;
}

/**
 * The one-shot end-to-end translate flow. Whole-run failures (config already validated
 * by the caller, unknown format, provider construction, unreadable/invalid source,
 * corrupt lock-file) throw a structured SdkError. Per-locale failures are isolated: a
 * failing locale is reported and the run continues; the lock-file reflects exactly the
 * locales that succeeded. Dry-run reads + diffs + reports without constructing/calling
 * the provider and without writing any file or the lock-file.
 *
 * A per-locale failure does not throw: it is recorded on that locale's {@link LocaleSummary} as
 * `status: "failed"` with a secret-free `{ code, message }`, where `code` is a preserved string (the
 * underlying provider/adapter code, or `"LOCALE_FAILED"` as a fallback), not necessarily an
 * {@link SdkErrorCode}. DeepL notices, integrity mismatches, and invalid-ICU source keys likewise
 * surface on each `LocaleSummary`, never as throws.
 *
 * A dry-run reads the lock once, outside any lock, and reuses that one snapshot for every locale:
 * it never writes, so there is nothing to serialize against. A live run instead re-reads the lock
 * fresh inside each locale's own write lock (see `runLiveLocale`), so two concurrent live calls
 * never both diff against the same stale pre-loop snapshot. The token-budget tracker is fresh per
 * invocation: the `maxTokens` ceiling is per-run, not cumulative across watch cycles.
 *
 * On a non-dry-run that reaches the end of the loop, the run's review-flag and token/usage data is
 * also written to `.verbatra-local/run-status.json` (readable back through {@link runStatus}). This
 * write is best-effort: any failure is caught and swallowed, never re-thrown and never reflected on
 * the returned {@link RunSummary}.
 *
 * @param input - The validated config and run options (cwd, dryRun, prune, generatePlurals).
 * @param deps - Optional composition seams (registry, provider builder, file system) for tests.
 * @returns A {@link RunSummary}: the per-locale {@link LocaleSummary}s and the succeeded/partial/failed locale lists.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`: no adapter is registered for the configured format.
 * @throws {@link SdkError} `PROVIDER_CONSTRUCTION_FAILED`: the provider factory threw (this wraps the
 *   provider's own error, including a missing `*_API_KEY` reported as `MISSING_API_KEY`); only on a
 *   non-dry-run, since dry-run never constructs the provider.
 * @throws {@link SdkError} `SOURCE_UNREADABLE`: the source locale file does not exist.
 * @throws {@link SdkError} `SOURCE_INVALID`: the source locale file could not be read or parsed (wraps the
 *   adapter read error).
 * @throws {@link SdkError} `LOCK_FILE_INVALID`: the lock-file is present but corrupt or oversized.
 * @throws {@link SdkError} `CONCURRENCY_INVALID`: `concurrency` is defined but not an integer of at
 *   least 1; raised before any locale runs.
 * @throws {@link SdkError} `CONCURRENCY_BUDGET_CONFLICT`: a live run set `concurrency` greater than 1
 *   while the config configures a `maxTokens` budget; raised before any provider call (a dry run is
 *   exempt).
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
  const concurrency = resolveRunConcurrency(input.concurrency, dryRun, config);
  const prune = input.prune ?? config.prune ?? false;
  const generatePlurals = input.generatePlurals ?? config.generatePlurals ?? false;
  const maxBatchSize = config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  const fs = deps.fs ?? defaultFs;
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
    ...(input.onLockWait !== undefined ? { onLockWait: input.onLockWait } : {}),
    ...(input.onProgress !== undefined ? { onProgress: input.onProgress } : {}),
    ...(input.lockAcquireTimeoutMs !== undefined
      ? { lockAcquireTimeoutMs: input.lockAcquireTimeoutMs }
      : {}),
  };

  const summaries = dryRun
    ? await runAllLocalesDry(context, config.targetLocales, concurrency)
    : await runAllLocalesLive(context, config.targetLocales, concurrency);
  input.onProgress?.({ type: "run-finished", localesCompleted: summaries.length });

  const { succeeded, partial, failed } = partition(summaries);
  const usage = summaries.reduce<ReturnType<typeof combineUsage>>(
    (total, summary) => combineUsage(total, summary.usage),
    undefined,
  );
  const budgetSummary = toBudgetSummary(budget);
  const summary: RunSummary = {
    dryRun,
    locales: summaries,
    succeeded,
    partial,
    failed,
    ...(usage !== undefined ? { usage } : {}),
    ...(budgetSummary !== undefined ? { budget: budgetSummary } : {}),
  };

  await recordRunStatus(cwd, dryRun, summary, fs);

  return summary;
}
