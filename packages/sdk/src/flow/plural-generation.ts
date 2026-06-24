import type { Tone, TranslateRequest, TranslationProvider } from "@verbatra/ai-providers";
import { contentHash, type LocaleResource, type TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";
import {
  type CldrPluralCategory,
  type PluralGenerationItem,
  planPluralGeneration,
} from "./plural-categories.js";

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
  /** Generated keys withheld for integrity failure (retried next run). */
  readonly withheld: readonly string[];
}

/**
 * Lock basis for a source-absent generated key. A generated key (for example `items_few`) has no
 * source entry, so its lock entry hashes the GOVERNING source plural forms of its base key plus the
 * category. The hash is stable while those source forms are unchanged (so the key is not regenerated)
 * and changes when any of them changes (so it is reconsidered) - the determinism contract from the spec.
 */
export function generatedLockHash(
  governingEntries: readonly TranslationEntry[],
  category: CldrPluralCategory,
): string {
  const governingHashes = governingEntries.map(contentHash).sort();
  // Reuse contentHash by feeding it a throwaway entry whose `value` encodes the category and the
  // sorted governing-form hashes. Only the returned hash string is used (stored in the lock); this
  // entry is never persisted, and its other fields are inert filler to satisfy the shape.
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
  };
}

/**
 * Generate the missing plural forms for one supported locale run. Only an i18next-JSON project with a
 * known richer target language yields any work (DeepL is gated out by the caller, which only calls this
 * for LLM providers). Generation rides the existing provider path: synthetic entries (the chosen source
 * form re-keyed, with the category as data context) are translated and integrity-checked exactly like any
 * other value. Forms whose placeholders do not match the source form are withheld. An item already locked
 * with an unchanged governing-source hash is skipped (no regeneration).
 *
 * @returns The accepted forms to write and the keys withheld for integrity failure. Empty when nothing
 *   applies, so the caller keeps the fallback warning.
 */
export async function generatePluralForms(
  context: PluralGenerationContext,
): Promise<PluralGenerationResult> {
  const plan = planPluralGeneration(context.source, context.targetLocale, context.format);
  const stale = staleItems(plan.items, context.baseline);
  if (stale.length === 0) {
    return { accepted: [], withheld: [] };
  }
  const entries = stale.map(syntheticEntry);
  const result = await context.provider.translateBatch(buildRequest(context, entries));

  const accepted: GeneratedForm[] = [];
  const withheld: string[] = [];
  for (const item of stale) {
    const value = result.values.get(item.targetKey);
    const integrity = result.integrity.get(item.targetKey);
    if (value !== undefined && integrity?.matches === true) {
      accepted.push({
        targetKey: item.targetKey,
        entry: { ...syntheticEntry(item), value },
        lockHash: generatedLockHash(item.governingEntries, item.category),
      });
    } else {
      withheld.push(item.targetKey);
    }
  }
  return { accepted, withheld };
}
