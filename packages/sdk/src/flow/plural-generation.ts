import type {
  Tone,
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import { contentHash, type LocaleResource, type TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";
import { chunk, subBatchFailedNotice } from "./batching.js";
import { type BudgetTracker, checkBudgetTrip, foldTrackerUsage } from "./budget.js";
import { readNotices } from "./notices.js";
import {
  type CldrPluralCategory,
  type PluralGenerationItem,
  planPluralGeneration,
} from "./plural-categories.js";
import type { LocaleNotice, UsageSummary } from "./summary.js";
import { createUsageAccumulator, foldUsage } from "./usage.js";

/** Everything plural generation needs from the locale run, without depending on the run module. */
export interface PluralGenerationContext {
  readonly source: LocaleResource;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly format: string;
  readonly adapter: FormatAdapter;
  readonly provider: TranslationProvider;
  readonly glossary: Readonly<Record<string, string>> | undefined;
  readonly tone: Tone | undefined;
  /** Prior lock baseline for the target, used to skip up-to-date generated keys. */
  readonly baseline: ReadonlyMap<string, string>;
  /**
   * Maximum entries per provider request. Stale generation items are split into sequential
   * sub-batches no larger than this, mirroring the main translation batching so one oversized
   * generation request cannot sink the whole locale.
   */
  readonly maxBatchSize: number;
  /** The run-wide token-budget tracker; a second token-spending loop feeding the same total and gate. */
  readonly budget: BudgetTracker;
}

/** One generated plural form accepted into the target file. */
export interface GeneratedForm {
  readonly targetKey: string;
  /** The synthetic entry to merge: drawn from the source form, with the generated value. */
  readonly entry: TranslationEntry;
  /** The lock hash for this generated key, derived from its governing source forms. */
  readonly lockHash: string;
}

export interface PluralGenerationResult {
  /** Forms generated and integrity-passing, ready to write. */
  readonly accepted: readonly GeneratedForm[];
  /** Generated keys withheld because the translation came back but failed the placeholder-integrity check. */
  readonly withheld: readonly string[];
  /**
   * Generated keys withheld because nothing was translated for them: either their sub-batch's provider
   * call itself threw, or the call succeeded but the key was still missing or duplicated in the
   * response after the shared LLM layer's bounded reconcile repair round.
   */
  readonly providerFailures: readonly string[];
  /**
   * Generated keys never sent to the provider because the run-wide token budget already tripped in
   * `"stop"` mode: every not-yet-attempted stale item, in this locale and, once tripped, every
   * subsequent one. Empty unless a budget is configured and behavior is `"stop"`.
   */
  readonly budgetWithheld: readonly string[];
  /** Notices from generation: a provider notice, or an SDK notice for a failed sub-batch. */
  readonly notices: readonly LocaleNotice[];
  /** Summed token usage across every generation sub-batch call for this locale; absent if none reported one. */
  readonly usage: UsageSummary | undefined;
  /** Whether a generation sub-batch's completion was the call that first crossed the configured budget. */
  readonly tripped: boolean;
}

/** The empty result for generation that made no provider call at all (disabled, or nothing stale). */
const EMPTY_RESULT: PluralGenerationResult = {
  accepted: [],
  withheld: [],
  providerFailures: [],
  budgetWithheld: [],
  notices: [],
  usage: undefined,
  tripped: false,
};

/**
 * Lock basis for a source-absent generated key: hash the governing source plural forms of its base key
 * plus the category. Stable while those source forms are unchanged, changing when any of them changes.
 */
export function generatedLockHash(
  governingEntries: readonly TranslationEntry[],
  category: CldrPluralCategory,
): string {
  const governingHashes = governingEntries.map(contentHash).sort();
  // Reuse contentHash with a throwaway entry whose value encodes the category and governing-form hashes.
  return contentHash({
    key: "",
    namespace: "",
    value: `${category}:${governingHashes.join("|")}`,
    placeholders: [],
    isPlural: true,
  });
}

/** A synthetic source entry for the request: the chosen source form, re-keyed to the target key. */
function syntheticEntry(item: PluralGenerationItem): TranslationEntry {
  return {
    ...item.sourceEntry,
    key: item.targetKey,
    isPlural: true,
    // The CLDR category travels as data context (the meaning field), never the instruction channel.
    meaning: `CLDR plural category "${item.category}"`,
  };
}

/** Plan items whose lock hash differs from the baseline: not yet generated or governing source changed. */
function staleItems(
  items: readonly PluralGenerationItem[],
  baseline: ReadonlyMap<string, string>,
): PluralGenerationItem[] {
  return items.filter((item) => {
    const hash = generatedLockHash(item.governingEntries, item.category);
    return baseline.get(item.targetKey) !== hash;
  });
}

function buildRequest(
  context: PluralGenerationContext,
  entries: readonly TranslationEntry[],
): TranslateRequest {
  return {
    sourceLocale: context.sourceLocale,
    targetLocale: context.targetLocale,
    entries,
    extractPlaceholders: context.adapter.extractPlaceholders,
    ...(context.glossary !== undefined ? { glossary: context.glossary } : {}),
    ...(context.tone !== undefined ? { tone: context.tone } : {}),
    ...(context.adapter.comparePlaceholders !== undefined
      ? { comparePlaceholders: context.adapter.comparePlaceholders }
      : {}),
  };
}

/**
 * Generate the missing plural forms for one supported locale run. Stale items are split into
 * sequential sub-batches no larger than `maxBatchSize` (mirroring the main translation batching), so
 * one oversized generation request cannot sink the whole locale. Synthetic entries are translated and
 * integrity-checked like any other value; forms whose placeholders do not match are withheld, an item
 * already locked with an unchanged governing-source hash is skipped, and a sub-batch whose provider call
 * throws withholds only its own forms while other sub-batches (and any already-accepted main
 * translations) are unaffected.
 */
export async function generatePluralForms(
  context: PluralGenerationContext,
): Promise<PluralGenerationResult> {
  const plan = planPluralGeneration(context.source, context.targetLocale, context.format);
  const stale = staleItems(plan.items, context.baseline);
  if (stale.length === 0) {
    return EMPTY_RESULT;
  }

  const accepted: GeneratedForm[] = [];
  const withheld: string[] = [];
  const providerFailures: string[] = [];
  const budgetWithheld: string[] = [];
  const notices: LocaleNotice[] = [];
  const usage = createUsageAccumulator();
  let tripped = false;
  for (const batch of chunk(stale, context.maxBatchSize)) {
    if (context.budget.stopped) {
      for (const item of batch) {
        budgetWithheld.push(item.targetKey);
      }
      continue;
    }
    const subResult = await runGenerationSubBatch(
      context,
      batch,
      accepted,
      withheld,
      providerFailures,
    );
    notices.push(...subResult.notices);
    foldUsage(usage, subResult.usage);
    foldTrackerUsage(context.budget, subResult.usage);
    if (checkBudgetTrip(context.budget)) {
      tripped = true;
    }
  }
  return {
    accepted,
    withheld,
    providerFailures,
    budgetWithheld,
    notices,
    usage: usage.total,
    tripped,
  };
}

interface GenerationSubBatchResult {
  readonly notices: readonly LocaleNotice[];
  readonly usage: TranslateResult["usage"];
}

/**
 * Run one plural-generation sub-batch and fold its result into `accepted`, `withheld`, or
 * `providerFailures`. A thrown provider call (nothing was translated) is caught, never re-thrown, and
 * withheld under `providerFailures`, not `withheld` (which is reserved for a translation that came back
 * but failed the placeholder-integrity check), the same distinction `runSubBatch` draws for main
 * translations. A key still missing from `result.values` after the shared LLM layer's bounded reconcile
 * repair round falls into the same `providerFailures` bucket: nothing was translated for it either.
 */
async function runGenerationSubBatch(
  context: PluralGenerationContext,
  batch: readonly PluralGenerationItem[],
  accepted: GeneratedForm[],
  withheld: string[],
  providerFailures: string[],
): Promise<GenerationSubBatchResult> {
  let result: TranslateResult;
  try {
    const entries = batch.map(syntheticEntry);
    result = await context.provider.translateBatch(buildRequest(context, entries));
  } catch (error) {
    for (const item of batch) {
      providerFailures.push(item.targetKey);
    }
    return { notices: [subBatchFailedNotice(batch.length, error)], usage: undefined };
  }
  for (const item of batch) {
    foldGenerationItem(item, result, accepted, withheld, providerFailures);
  }
  return { notices: readNotices(result), usage: result.usage };
}

/** Fold one plural-generation item's outcome into `accepted`, `withheld`, or `providerFailures`. */
function foldGenerationItem(
  item: PluralGenerationItem,
  result: TranslateResult,
  accepted: GeneratedForm[],
  withheld: string[],
  providerFailures: string[],
): void {
  const value = result.values.get(item.targetKey);
  if (value === undefined) {
    providerFailures.push(item.targetKey);
    return;
  }
  if (result.integrity.get(item.targetKey)?.matches === true) {
    accepted.push({
      targetKey: item.targetKey,
      entry: { ...syntheticEntry(item), value },
      lockHash: generatedLockHash(item.governingEntries, item.category),
    });
  } else {
    withheld.push(item.targetKey);
  }
}
