import type {
  ReviewFlag,
  Tone,
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
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
import type { LocaleNotice, LocaleSummary, NeedsReviewEntry, UsageSummary } from "./summary.js";
import { combineUsage, createUsageAccumulator, foldUsage } from "./usage.js";

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

export interface LocaleRunResult {
  readonly summary: LocaleSummary;
  readonly lockEntries: Record<string, string>;
}

interface Accepted {
  readonly value: string;
  readonly source: TranslationEntry;
}

function emptyResource(locale: string, format: SupportedFormat): LocaleResource {
  return { locale, namespace: "", format, entries: new Map() };
}

async function readTarget(params: LocaleRunParams): Promise<LocaleResource> {
  const path = localeFilePath(params.cwd, params.filesPattern, params.targetLocale);
  if (!(await params.fs.fileExists(path))) {
    return emptyResource(params.targetLocale, params.format);
  }
  return (await params.adapter.read(path, params.targetLocale)).resource;
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
 * Run one target locale: read, diff, translate, integrity-check, write, and compute the lock entries.
 * A dry-run (provider undefined) stops after the diff. May throw; the orchestrator isolates that as a
 * per-locale failure.
 */
export async function runLocale(params: LocaleRunParams): Promise<LocaleRunResult> {
  const target = await readTarget(params);
  const diff = diffResources(params.source, target, { baseline: params.baseline });

  // Generated plural forms are not true orphans, so when generation is on keep them out of orphaned/pruning.
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
    // Dry-run: report what would change, write nothing.
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

  // Captured before this locale makes any call: distinguishes "this locale caused the trip" from
  // "a prior locale already tripped stop mode", each of which the budget notice is worded around.
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
  // Drop pruned (source-absent) orphans before merging; accepted keys are source-present and never collide.
  for (const key of pruned) {
    merged.delete(key);
  }
  for (const [key, { value, source }] of accepted) {
    // Carry the source entry's fields but the target's namespace and the translated value.
    merged.set(key, { ...source, value, namespace: target.namespace });
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
    // Source-present keys withheld by the budget guardrail must keep their prior lock hash too.
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
      // Withheld generated forms surface alongside withheld translations: both failed integrity.
      integrityMismatches: [...integrityMismatches, ...generation.withheld].sort(),
      // A generation sub-batch whose provider call itself threw is a provider failure, never integrity.
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

/** Run plural generation when enabled and the provider is an LLM; otherwise skip and fall back to the warning. */
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
 * One `BUDGET_TOKENS_EXCEEDED` notice for this locale if it caused the trip (main translation or
 * generation), or if it started already stopped by an earlier locale's trip (`stop` mode only);
 * otherwise none. Never more than one per locale.
 */
function budgetLocaleNotices(
  budget: BudgetTracker,
  startedStopped: boolean,
  mainTripped: boolean,
  generationTripped: boolean,
): readonly LocaleNotice[] {
  return startedStopped || mainTripped || generationTripped ? [budgetExceededNotice(budget)] : [];
}

/** Recompute the plural warning per base key against the written target; a complete generated set clears it. */
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
    status: "succeeded",
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
 * Split entries into sequential sub-batches of at most `maxBatchSize` and run each as its own request.
 * The budget is checked between completed sub-batches (see `translate-project.ts` for why never
 * mid-batch): once `stop` mode trips, remaining sub-batches are withheld without a provider call.
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
 * Run one sub-batch and fold its result into `accepted`, `integrityMismatches`, or `providerFailures`.
 * A thrown provider call (a revoked key, a rate limit, a network timeout, ...) is caught, never
 * re-thrown, and never surfaced as an integrity problem: nothing was translated, so the whole
 * sub-batch's keys are withheld under `providerFailures` and a secret-free notice carrying the
 * failure's code and message is returned. The same `providerFailures` bucket also collects a key the
 * provider call returned no value for at all: the shared LLM layer's bounded reconcile repair round
 * (see `runLlmTranslation`) already retried it once, so a key still absent from `result.values` here
 * means nothing was ever translated for it, exactly like a thrown call, and not a placeholder mismatch.
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
    for (const entry of batch) {
      providerFailures.push(entry.key);
    }
    return { notices: [subBatchFailedNotice(batch.length, error)], usage: undefined };
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

/**
 * Fold one entry's outcome into `accepted`, `integrityMismatches`, or `providerFailures`. The
 * accept/reject decision is recomputed directly from the candidate value via the shared
 * {@link gateCandidateValue}, never trusting the provider's own `result.integrity` report: this is
 * the same accept/reject choke point workbook import and the future write-capable seams call.
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
 * Lock entries for the written target: the current source hash for every source-present key, except keys
 * withheld this run (those keep their prior baseline hash so they retry). Generated plural keys are
 * source-absent and instead carry their own governing-source hash ({@link GeneratedForm.lockHash}).
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
      // Carry a prior generated-plural lock entry forward (only when generation is enabled).
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

/** Preserve a prior lock entry for a generated plural key that stayed in the target but was not regenerated. */
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
