import {
  ProviderError,
  type ReviewFlag,
  type Tone,
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
} from "@verbatra/ai-providers";
import {
  contentHash,
  diffResources,
  type LocaleResource,
  type SupportedFormat,
  type TranslationEntry,
} from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";
import type { SdkFs } from "../fs.js";
import { localeFilePath } from "../paths.js";
import { chunk, subBatchFailedNotice } from "./batching.js";
import {
  type BudgetTracker,
  budgetExceededNotice,
  checkBudgetTrip,
  foldTrackerUsage,
} from "./budget.js";
import { gateCandidateValue } from "./integrity-gate.js";
import { deriveLocaleStatus } from "./locale-failure.js";
import { readNotices } from "./notices.js";
import {
  detectMissingPluralCategories,
  isGeneratedPluralKey,
  pluralIncompleteNotice,
  sourcePluralBaseKeys,
  targetPluralSetIncomplete,
} from "./plural-categories.js";
import {
  type GeneratedForm,
  generatePluralForms,
  type PluralGenerationResult,
} from "./plural-generation.js";
import { readTargetResource } from "./read-target.js";
import type { LocaleNotice, LocaleSummary, NeedsReviewEntry, UsageSummary } from "./summary.js";
import { combineUsage, createUsageAccumulator, foldUsage } from "./usage.js";

/** Everything {@link runLocale} needs to process one target locale, resolved by the orchestrator. */
export interface LocaleRunParams {
  readonly source: LocaleResource;
  readonly sourceInvalidIcuKeys: readonly string[];
  readonly baseline: ReadonlyMap<string, string>;
  readonly adapter: FormatAdapter;
  /** Undefined signals dry-run: the provider is neither constructed nor called. */
  readonly provider: TranslationProvider | undefined;
  readonly cwd: string;
  readonly filesPattern: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly format: SupportedFormat;
  readonly glossary: Readonly<Record<string, string>> | undefined;
  readonly tone: Tone | undefined;
  /** When true, orphaned keys (diff.orphaned) are removed from the written file and the lock. */
  readonly prune: boolean;
  /**
   * When true, synthesize the CLDR plural forms a richer target language needs but the source lacks
   * (i18next-JSON + LLM provider only); every other case falls back to the warning.
   */
  readonly generatePlurals: boolean;
  /**
   * Maximum entries per provider request. Entries are split into sequential sub-batches no larger than
   * this. A positive integer, guaranteed by the config schema.
   */
  readonly maxBatchSize: number;
  readonly fs: SdkFs;
  /** The run-wide token-budget tracker, shared and mutated across every locale in the run. */
  readonly budget: BudgetTracker;
}

/** One locale's outcome: the public summary and the lock entries to persist for it. */
export interface LocaleRunResult {
  readonly summary: LocaleSummary;
  readonly lockEntries: Record<string, string>;
}

interface Accepted {
  readonly value: string;
  readonly source: TranslationEntry;
}

function buildRequest(
  params: LocaleRunParams,
  entries: readonly TranslationEntry[],
): TranslateRequest {
  return {
    sourceLocale: params.sourceLocale,
    targetLocale: params.targetLocale,
    entries,
    extractPlaceholders: params.adapter.extractPlaceholders,
    ...(params.glossary !== undefined ? { glossary: params.glossary } : {}),
    ...(params.tone !== undefined ? { tone: params.tone } : {}),
    ...(params.adapter.comparePlaceholders !== undefined
      ? { comparePlaceholders: params.adapter.comparePlaceholders }
      : {}),
  };
}

/**
 * Runs one target locale: read, diff, translate, integrity-check, write, and compute the lock
 * entries. A dry-run (provider undefined) stops after the diff and reports what would change.
 * Accepted translations are applied in source-document order, not diff order, so a key already in
 * the target keeps its position (Map.set semantics) and a new key appends where the source puts it.
 * When generation is on, source-absent keys that look like generated plural forms are kept out of
 * the orphaned and pruned lists. May throw; the orchestrator isolates that as a per-locale failure.
 */
export async function runLocale(params: LocaleRunParams): Promise<LocaleRunResult> {
  const target = await readTargetResource({
    cwd: params.cwd,
    filesPattern: params.filesPattern,
    format: params.format,
    locale: params.targetLocale,
    adapter: params.adapter,
    fs: params.fs,
  });
  const diff = diffResources(params.source, target, { baseline: params.baseline });

  const orphaned = params.generatePlurals
    ? diff.orphaned.filter((key) => !isGeneratedPluralKey(key, sourcePluralBaseKeys(params.source)))
    : diff.orphaned;

  const pruned: readonly string[] = params.prune ? orphaned : [];

  const invalidIcu = new Set(params.sourceInvalidIcuKeys);
  const candidates = [...diff.missing, ...diff.changed];
  const toTranslate = candidates.filter((key) => !invalidIcu.has(key));
  const invalidIcuSource = candidates.filter((key) => invalidIcu.has(key));

  const pluralNotice = detectMissingPluralCategories(
    params.source,
    params.targetLocale,
    params.format,
  );
  const sdkNotices: readonly LocaleNotice[] = pluralNotice ? [pluralNotice] : [];

  const provider = params.provider;
  if (provider === undefined) {
    return {
      summary: baseSummary({
        locale: params.targetLocale,
        unchanged: diff.unchanged,
        orphaned,
        invalidIcuSource,
        translated: toTranslate,
        generated: [],
        integrityMismatches: [],
        providerFailures: [],
        budgetWithheld: [],
        pruned,
        notices: sdkNotices,
      }),
      lockEntries: {},
    };
  }

  const entries = toTranslate
    .map((key) => params.source.entries.get(key))
    .filter((entry): entry is TranslationEntry => entry !== undefined);

  const startedStopped = params.budget.stopped;
  const accepted = new Map<string, Accepted>();
  const integrityMismatches: string[] = [];
  const providerFailures: string[] = [];
  const budgetWithheld: string[] = [];
  const reviewFlags = new Map<string, ReviewFlag>();
  const translation = await translateAndCheck(
    provider,
    params,
    entries,
    accepted,
    integrityMismatches,
    providerFailures,
    budgetWithheld,
    reviewFlags,
  );

  const merged = new Map(target.entries);
  for (const key of pruned) {
    merged.delete(key);
  }
  for (const key of params.source.entries.keys()) {
    const hit = accepted.get(key);
    if (hit !== undefined) {
      merged.set(key, { ...hit.source, value: hit.value, namespace: target.namespace });
    }
  }

  const generation = await runGeneration(params, provider);
  for (const form of generation.accepted) {
    merged.set(form.targetKey, { ...form.entry, namespace: target.namespace });
  }

  const path = localeFilePath(params.cwd, params.filesPattern, params.targetLocale);
  await params.adapter.write(
    {
      locale: params.targetLocale,
      namespace: target.namespace,
      format: params.format,
      entries: merged,
    },
    path,
  );

  const pluralNotices = params.generatePlurals ? pluralNoticeFor(params, merged) : sdkNotices;
  const notices: readonly LocaleNotice[] = [
    ...pluralNotices,
    ...translation.notices,
    ...generation.notices,
    ...budgetLocaleNotices(params.budget, startedStopped, translation.tripped, generation.tripped),
  ];

  const withheld = new Set([
    ...integrityMismatches,
    ...providerFailures,
    ...invalidIcuSource,
    ...generation.withheld,
    ...generation.providerFailures,
    ...budgetWithheld,
  ]);
  const localeUsage = combineUsage(translation.usage, generation.usage);
  return {
    summary: baseSummary({
      locale: params.targetLocale,
      unchanged: diff.unchanged,
      orphaned,
      invalidIcuSource,
      translated: [...accepted.keys()],
      generated: generation.accepted.map((form) => form.targetKey).sort(),
      integrityMismatches: [...integrityMismatches, ...generation.withheld].sort(),
      providerFailures: [...providerFailures, ...generation.providerFailures].sort(),
      budgetWithheld: [...budgetWithheld, ...generation.budgetWithheld].sort(),
      pruned,
      notices,
      needsReview: needsReviewFor(accepted.keys(), reviewFlags),
      ...(localeUsage !== undefined ? { usage: localeUsage } : {}),
    }),
    lockEntries: computeLockEntries(params, merged, withheld, generation.accepted),
  };
}

/** The empty generation result for when generation is disabled or the provider does not support it. */
const NO_GENERATION_RESULT: PluralGenerationResult = {
  accepted: [],
  withheld: [],
  providerFailures: [],
  budgetWithheld: [],
  notices: [],
  usage: undefined,
  tripped: false,
};

/** Runs plural generation when enabled and the provider is an LLM; otherwise returns the empty result. */
async function runGeneration(
  params: LocaleRunParams,
  provider: TranslationProvider,
): Promise<PluralGenerationResult> {
  if (!params.generatePlurals || provider.kind !== "llm") {
    return NO_GENERATION_RESULT;
  }
  return generatePluralForms({
    source: params.source,
    sourceLocale: params.sourceLocale,
    targetLocale: params.targetLocale,
    format: params.format,
    adapter: params.adapter,
    provider,
    glossary: params.glossary,
    tone: params.tone,
    baseline: params.baseline,
    maxBatchSize: params.maxBatchSize,
    budget: params.budget,
  });
}

/**
 * Emits one `BUDGET_TOKENS_EXCEEDED` notice for this locale if it caused the trip (main
 * translation or generation), or if it started already stopped by an earlier locale's trip
 * (`stop` mode only); otherwise none. Never more than one per locale.
 */
function budgetLocaleNotices(
  budget: BudgetTracker,
  startedStopped: boolean,
  mainTripped: boolean,
  generationTripped: boolean,
): readonly LocaleNotice[] {
  return startedStopped || mainTripped || generationTripped ? [budgetExceededNotice(budget)] : [];
}

/** Recomputes the plural warning against the written target (i18next-json only); a complete set clears it. */
function pluralNoticeFor(
  params: LocaleRunParams,
  merged: ReadonlyMap<string, TranslationEntry>,
): readonly LocaleNotice[] {
  if (params.format !== "i18next-json") {
    return [];
  }
  if (!targetPluralSetIncomplete(merged.keys(), params.targetLocale)) {
    return [];
  }
  return [pluralIncompleteNotice(params.targetLocale)];
}

interface SummaryParts {
  readonly locale: string;
  readonly unchanged: readonly string[];
  readonly orphaned: readonly string[];
  readonly invalidIcuSource: readonly string[];
  readonly translated: readonly string[];
  readonly generated: readonly string[];
  readonly integrityMismatches: readonly string[];
  readonly providerFailures: readonly string[];
  readonly budgetWithheld: readonly string[];
  readonly pruned: readonly string[];
  readonly notices: readonly LocaleNotice[];
  readonly usage?: UsageSummary;
  /** Defaults to empty: a dry-run never calls a provider, so it never has anything to flag. */
  readonly needsReview?: readonly NeedsReviewEntry[];
}

function baseSummary(parts: SummaryParts): LocaleSummary {
  return {
    locale: parts.locale,
    status: deriveLocaleStatus(parts),
    translated: parts.translated,
    unchanged: parts.unchanged,
    orphaned: parts.orphaned,
    pruned: parts.pruned,
    invalidIcuSource: parts.invalidIcuSource,
    integrityMismatches: parts.integrityMismatches,
    providerFailures: parts.providerFailures,
    budgetWithheld: parts.budgetWithheld,
    generated: parts.generated,
    notices: parts.notices,
    needsReview: parts.needsReview ?? [],
    ...(parts.usage !== undefined ? { usage: parts.usage } : {}),
  };
}

/** Every accepted key with a non-empty review flag, sorted by key. */
function needsReviewFor(
  acceptedKeys: Iterable<string>,
  reviewFlags: ReadonlyMap<string, ReviewFlag>,
): readonly NeedsReviewEntry[] {
  const entries: NeedsReviewEntry[] = [];
  for (const key of acceptedKeys) {
    const flag = reviewFlags.get(key);
    if (flag !== undefined) {
      entries.push({ key, reasons: flag.reasons });
    }
  }
  return entries.sort((a, b) => (a.key < b.key ? -1 : 1));
}

interface TranslateAndCheckResult {
  readonly notices: readonly LocaleNotice[];
  /** Whether a sub-batch in this call was the one that first crossed the configured budget. */
  readonly tripped: boolean;
  readonly usage: UsageSummary | undefined;
}

/**
 * Splits entries into sequential sub-batches of at most `maxBatchSize` and runs each as its own
 * request. The budget is checked between completed sub-batches (see `translate-project.ts` for why
 * never mid-batch): once `stop` mode trips, remaining sub-batches are withheld without a provider
 * call.
 */
async function translateAndCheck(
  provider: TranslationProvider,
  params: LocaleRunParams,
  entries: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
  providerFailures: string[],
  budgetWithheld: string[],
  reviewFlags: Map<string, ReviewFlag>,
): Promise<TranslateAndCheckResult> {
  const notices: LocaleNotice[] = [];
  const usage = createUsageAccumulator();
  let tripped = false;
  for (const batch of chunk(entries, params.maxBatchSize)) {
    if (params.budget.stopped) {
      for (const entry of batch) {
        budgetWithheld.push(entry.key);
      }
      continue;
    }
    const subResult = await runSubBatch(
      provider,
      params,
      batch,
      accepted,
      integrityMismatches,
      providerFailures,
      reviewFlags,
    );
    notices.push(...subResult.notices);
    foldUsage(usage, subResult.usage);
    foldTrackerUsage(params.budget, subResult.usage);
    if (checkBudgetTrip(params.budget)) {
      tripped = true;
    }
  }
  return { notices, tripped, usage: usage.total };
}

interface SubBatchResult {
  readonly notices: readonly LocaleNotice[];
  readonly usage: TranslateResult["usage"];
}

/**
 * Runs one sub-batch and folds its result into `accepted`, `integrityMismatches`, or
 * `providerFailures`. A thrown provider call (a revoked key, a rate limit, a network timeout) is
 * caught, never re-thrown, and never surfaced as an integrity problem: nothing was translated, so
 * the whole sub-batch's keys are withheld under `providerFailures` and a secret-free notice
 * carrying the failure's code and message is returned. The same `providerFailures` bucket also
 * collects a key the provider call returned no value for at all: a key still absent from
 * `result.values` here means nothing was ever translated for it, exactly like a thrown call, and
 * not a placeholder mismatch. An `OUTPUT_TRUNCATED` failure is the one exception: rather than
 * withhold the whole batch, {@link handleSubBatchFailure} re-splits it and retries the halves.
 */
async function runSubBatch(
  provider: TranslationProvider,
  params: LocaleRunParams,
  batch: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
  providerFailures: string[],
  reviewFlags: Map<string, ReviewFlag>,
): Promise<SubBatchResult> {
  let result: TranslateResult;
  try {
    result = await provider.translateBatch(buildRequest(params, batch));
  } catch (error) {
    return handleSubBatchFailure(
      error,
      provider,
      params,
      batch,
      accepted,
      integrityMismatches,
      providerFailures,
      reviewFlags,
    );
  }
  for (const entry of batch) {
    foldEntryResult(entry, result, params.adapter, accepted, integrityMismatches, providerFailures);
  }
  if (result.reviewFlags !== undefined) {
    for (const [key, flag] of result.reviewFlags) {
      reviewFlags.set(key, flag);
    }
  }
  return { notices: readNotices(result), usage: result.usage };
}

/** True only for a genuine {@link ProviderError} whose code is `OUTPUT_TRUNCATED`. */
function isOutputTruncated(error: unknown): boolean {
  return error instanceof ProviderError && error.code === "OUTPUT_TRUNCATED";
}

/**
 * Handles a thrown sub-batch call. Only an `OUTPUT_TRUNCATED` error on a multi-entry batch (a
 * response whose hidden reasoning or content tokens exhausted the output budget) is recoverable:
 * {@link retryTruncatedSplit} re-splits the batch into halves and retries each on its own, down
 * toward a single entry, so keys that fit a smaller request are still translated and retained in
 * `accepted`. Every other thrown value (a revoked key, a rate limit, an auth failure), and a
 * single-entry batch that still truncates, withholds the whole batch under `providerFailures` with
 * a secret-free notice; those keys retry next run.
 */
async function handleSubBatchFailure(
  error: unknown,
  provider: TranslationProvider,
  params: LocaleRunParams,
  batch: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
  providerFailures: string[],
  reviewFlags: Map<string, ReviewFlag>,
): Promise<SubBatchResult> {
  if (isOutputTruncated(error) && batch.length > 1) {
    return retryTruncatedSplit(
      provider,
      params,
      batch,
      accepted,
      integrityMismatches,
      providerFailures,
      reviewFlags,
    );
  }
  for (const entry of batch) {
    providerFailures.push(entry.key);
  }
  return { notices: [subBatchFailedNotice(batch.length, error)], usage: undefined };
}

/**
 * Re-splits a truncated sub-batch into two halves (reusing {@link chunk}) and runs each through
 * {@link runSubBatch} on its own, combining their notices and usage. Recursion is bounded: each
 * half is strictly smaller than the batch, and a single entry that still truncates is recorded as a
 * `providerFailure` by {@link handleSubBatchFailure} rather than split again.
 */
async function retryTruncatedSplit(
  provider: TranslationProvider,
  params: LocaleRunParams,
  batch: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
  providerFailures: string[],
  reviewFlags: Map<string, ReviewFlag>,
): Promise<SubBatchResult> {
  const notices: LocaleNotice[] = [];
  let usage: TranslateResult["usage"];
  for (const half of chunk(batch, Math.ceil(batch.length / 2))) {
    const sub = await runSubBatch(
      provider,
      params,
      half,
      accepted,
      integrityMismatches,
      providerFailures,
      reviewFlags,
    );
    notices.push(...sub.notices);
    usage = combineUsage(usage, sub.usage);
  }
  return { notices, usage };
}

/**
 * Folds one entry's outcome into `accepted`, `integrityMismatches`, or `providerFailures`. The
 * accept/reject decision is recomputed directly from the candidate value via the shared
 * {@link gateCandidateValue}, never trusting the provider's own `result.integrity` report.
 */
function foldEntryResult(
  entry: TranslationEntry,
  result: TranslateResult,
  adapter: FormatAdapter,
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
  providerFailures: string[],
): void {
  const value = result.values.get(entry.key);
  if (value === undefined) {
    providerFailures.push(entry.key);
    return;
  }
  if (gateCandidateValue(entry, value, adapter).accepted) {
    accepted.set(entry.key, { value, source: entry });
  } else {
    integrityMismatches.push(entry.key);
  }
}

/**
 * Computes the lock entries for the written target: the current source hash for every
 * source-present key, except keys withheld this run (those keep their prior baseline hash so they
 * retry). Generated plural keys are source-absent and instead carry their own governing-source
 * hash ({@link GeneratedForm.lockHash}).
 */
function computeLockEntries(
  params: LocaleRunParams,
  merged: ReadonlyMap<string, TranslationEntry>,
  withheld: ReadonlySet<string>,
  generated: readonly GeneratedForm[],
): Record<string, string> {
  const lockEntries: Record<string, string> = {};
  const sourceBaseKeys = sourcePluralBaseKeys(params.source);
  for (const key of merged.keys()) {
    const sourceEntry = params.source.entries.get(key);
    if (sourceEntry === undefined) {
      if (params.generatePlurals) {
        carryGeneratedLock(lockEntries, params.baseline, key, sourceBaseKeys);
      }
      continue;
    }
    if (withheld.has(key)) {
      const prior = params.baseline.get(key);
      if (prior !== undefined) {
        lockEntries[key] = prior;
      }
      continue;
    }
    lockEntries[key] = contentHash(sourceEntry);
  }
  for (const form of generated) {
    lockEntries[form.targetKey] = form.lockHash;
  }
  return lockEntries;
}

/** Preserves the prior lock entry for a generated plural key that stayed in the target but was not regenerated. */
function carryGeneratedLock(
  lockEntries: Record<string, string>,
  baseline: ReadonlyMap<string, string>,
  key: string,
  sourceBaseKeys: ReadonlySet<string>,
): void {
  if (!isGeneratedPluralKey(key, sourceBaseKeys)) {
    return;
  }
  const prior = baseline.get(key);
  if (prior !== undefined) {
    lockEntries[key] = prior;
  }
}
