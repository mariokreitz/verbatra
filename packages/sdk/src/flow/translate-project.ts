import type { TranslationProvider } from "@verbatra/ai-providers";
import type { AdapterRegistry, FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import { computeFingerprint } from "../cache/fingerprint.js";
import {
  additionsToRecord,
  applyAdditions,
  CACHE_FILE_NAME,
  cacheFilePath,
  readTranslationMemory,
  writeTranslationMemory,
} from "../cache/translation-memory.js";
import type { TranslationMemory } from "../cache/types.js";
import {
  DEFAULT_BUDGET_BEHAVIOR,
  DEFAULT_MAX_BATCH_SIZE,
  type VerbatraConfig,
} from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { createLocalePathResolver, type LocalePathResolver } from "../locale-path/resolver.js";
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
import { readSourceResource } from "./source.js";
import type { LocaleSummary, RunSummary, SdkNotice } from "./summary.js";
import { combineUsage } from "./usage.js";

export interface TranslateInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly dryRun?: boolean;
  readonly prune?: boolean;
  readonly generatePlurals?: boolean;
  readonly onLockWait?: LockWaitListener;
  readonly onProgress?: ProgressListener;
  readonly lockAcquireTimeoutMs?: number;
  readonly concurrency?: number;
  readonly cache?: boolean;
}

export interface TranslateDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly createProvider?: CreateProvider;
  readonly fs?: SdkFs;
}

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

interface RunCacheState {
  readonly memory: TranslationMemory;
  readonly fingerprint: string;
  readonly additions: Map<string, Record<string, string>>;
  readonly writable: boolean;
}

async function createRunCacheState(
  input: TranslateInput,
  config: VerbatraConfig,
  cwd: string,
  dryRun: boolean,
  fs: SdkFs,
): Promise<RunCacheState | undefined> {
  if (dryRun || input.cache === false) {
    return undefined;
  }
  const { memory, writable } = await readTranslationMemory(cacheFilePath(cwd), fs);
  return { memory, writable, fingerprint: computeFingerprint(config), additions: new Map() };
}

function withCacheNotices(
  summaries: readonly LocaleSummary[],
  cache: RunCacheState | undefined,
): LocaleSummary[] {
  if (cache === undefined || cache.writable) {
    return [...summaries];
  }
  const notice: SdkNotice = {
    code: "CACHE_VERSION_UNRECOGNIZED",
    message:
      `${CACHE_FILE_NAME} carries a version this build does not recognize, so it was written by a ` +
      "newer verbatra. It was left untouched and this run used no cache. Upgrade verbatra, or " +
      "delete the file to rebuild it in this build's format.",
  };
  return summaries.map((summary) => ({ ...summary, notices: [...summary.notices, notice] }));
}

async function recordCacheAdditions(
  cwd: string,
  cache: RunCacheState | undefined,
  fs: SdkFs,
): Promise<void> {
  if (cache === undefined || cache.additions.size === 0 || !cache.writable) {
    return;
  }
  try {
    const merged = applyAdditions(cache.memory, cache.fingerprint, cache.additions);
    await writeTranslationMemory(cacheFilePath(cwd), merged, fs);
  } catch {}
}

interface LocaleRunContext {
  readonly source: ReadResult;
  readonly adapter: FormatAdapter;
  readonly provider: TranslationProvider | undefined;
  readonly cwd: string;
  readonly config: VerbatraConfig;
  readonly resolver: LocalePathResolver;
  readonly prune: boolean;
  readonly generatePlurals: boolean;
  readonly maxBatchSize: number;
  readonly fs: SdkFs;
  readonly budget: BudgetTracker;
  readonly cache: RunCacheState | undefined;
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
    resolver: context.resolver,
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
    ...(context.cache !== undefined
      ? { cache: { snapshot: context.cache.memory, fingerprint: context.cache.fingerprint } }
      : {}),
    ...(context.onProgress !== undefined ? { onProgress: context.onProgress } : {}),
  };
}

async function runDryLocale(
  context: LocaleRunContext,
  targetLocale: string,
  lock: LockFile,
): Promise<LocaleSummary> {
  const params = buildLocaleRunParams(context, targetLocale, baselineFor(lock, targetLocale));
  return (await runLocale(params)).summary;
}

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
      if (context.cache !== undefined && result.cacheAdditions.length > 0) {
        context.cache.additions.set(targetLocale, additionsToRecord(result.cacheAdditions));
      }
      return result.summary;
    },
    lockOptions,
  );
}

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
    localeIndex,
    totalLocales: targetLocales.length,
  });
}

async function runLocalesWithProgress(
  context: LocaleRunContext,
  targetLocales: readonly string[],
  runOne: (targetLocale: string) => Promise<LocaleSummary>,
  concurrency: number,
): Promise<LocaleSummary[]> {
  const totalLocales = targetLocales.length;
  const results: (LocaleSummary | undefined)[] = new Array<LocaleSummary | undefined>(totalLocales);
  let nextIndex = 0;
  let abort: { readonly reason: unknown } | undefined;

  async function worker(): Promise<void> {
    while (abort === undefined && nextIndex < totalLocales) {
      const localeIndex = nextIndex;
      nextIndex += 1;
      try {
        await runLocaleAt(context, targetLocales, localeIndex, runOne, results);
      } catch (error) {
        abort ??= { reason: error };
      }
    }
  }

  const workerCount = Math.min(concurrency, totalLocales);
  const workers: Promise<void>[] = [];
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  if (abort !== undefined) {
    throw abort.reason;
  }
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

export function resolveRunConcurrency(
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

  const resolver = createLocalePathResolver(cwd, config);
  const adapter = selectAdapter(config.format, deps.adapterRegistry);
  const provider = dryRun ? undefined : selectProvider(config.provider, deps.createProvider);

  const source = await readSourceResource(config, resolver, fs, adapter);
  const cache = await createRunCacheState(input, config, cwd, dryRun, fs);
  const context: LocaleRunContext = {
    source,
    adapter,
    provider,
    cwd,
    config,
    resolver,
    prune,
    generatePlurals,
    maxBatchSize,
    fs,
    budget,
    cache,
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

  const locales = withCacheNotices(summaries, cache);
  const { succeeded, partial, failed } = partition(locales);
  const usage = summaries.reduce<ReturnType<typeof combineUsage>>(
    (total, summary) => combineUsage(total, summary.usage),
    undefined,
  );
  const budgetSummary = toBudgetSummary(budget);
  const summary: RunSummary = {
    dryRun,
    locales,
    succeeded,
    partial,
    failed,
    ...(usage !== undefined ? { usage } : {}),
    ...(budgetSummary !== undefined ? { budget: budgetSummary } : {}),
  };

  await recordCacheAdditions(cwd, cache, fs);
  await recordRunStatus(cwd, dryRun, summary, fs);

  return summary;
}
