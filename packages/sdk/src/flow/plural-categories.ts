import type { LocaleResource, TranslationEntry } from "@verbatra/core";
import {
  type I18nextPluralCategory,
  makePluralKey,
  pluralBaseKey,
  pluralCategoryOf,
} from "@verbatra/format-adapters";
import type { SdkNotice } from "./summary.js";

/** The six CLDR cardinal plural categories. A language uses a subset of these. */
export type CldrPluralCategory = I18nextPluralCategory;

/**
 * Static map of language subtag to the CLDR cardinal plural categories it requires, for languages richer
 * than {one, other}. A static lookup, not a plural-rule engine: it only answers whether the target uses
 * more categories than the source supplied. Languages not listed are treated as {one, other}.
 */
const LANGUAGE_CATEGORIES: Readonly<Record<string, readonly CldrPluralCategory[]>> = {
  ar: ["zero", "one", "two", "few", "many", "other"],
  cy: ["zero", "one", "two", "few", "many", "other"],
  ga: ["one", "two", "few", "many", "other"],
  pl: ["one", "few", "many", "other"],
  ru: ["one", "few", "many", "other"],
  uk: ["one", "few", "many", "other"],
  be: ["one", "few", "many", "other"],
  lt: ["one", "few", "many", "other"],
  sl: ["one", "two", "few", "other"],
};

/** True when the target language's category set is known to be richer than {one, other}. */
function isKnownRicherLanguage(locale: string): boolean {
  const subtag = locale.toLowerCase().split(/[-_]/)[0] ?? "";
  return LANGUAGE_CATEGORIES[subtag] !== undefined;
}

/** The category set a target language requires; {one, other} when not specially listed. */
function requiredCategories(locale: string): readonly CldrPluralCategory[] {
  const subtag = locale.toLowerCase().split(/[-_]/)[0] ?? "";
  return LANGUAGE_CATEGORIES[subtag] ?? ["one", "other"];
}

/** Group the source's i18next plural entries by base key; non-plural keys are ignored. */
function groupPluralSources(
  source: LocaleResource,
): Map<string, Map<CldrPluralCategory, TranslationEntry>> {
  const groups = new Map<string, Map<CldrPluralCategory, TranslationEntry>>();
  for (const [key, entry] of source.entries) {
    const baseKey = pluralBaseKey(key);
    const category = pluralCategoryOf(key);
    if (baseKey === undefined || category === undefined) {
      continue;
    }
    const group = groups.get(baseKey) ?? new Map<CldrPluralCategory, TranslationEntry>();
    group.set(category, entry);
    groups.set(baseKey, group);
  }
  return groups;
}

/** The set of categories the source supplies anywhere (across all base keys). */
function suppliedCategories(
  groups: ReadonlyMap<string, ReadonlyMap<CldrPluralCategory, TranslationEntry>>,
): Set<CldrPluralCategory> {
  const supplied = new Set<CldrPluralCategory>();
  for (const group of groups.values()) {
    for (const category of group.keys()) {
      supplied.add(category);
    }
  }
  return supplied;
}

/**
 * Emit a per-locale notice when the target language requires more CLDR plural categories than the source
 * supplies. A no-op unless the format is "i18next-json"; returns undefined when nothing is missing.
 */
export function detectMissingPluralCategories(
  source: LocaleResource,
  targetLocale: string,
  format: string,
): SdkNotice | undefined {
  if (format !== "i18next-json") {
    return undefined;
  }
  const groups = groupPluralSources(source);
  const supplied = suppliedCategories(groups);
  if (supplied.size === 0) {
    return undefined;
  }
  const missing = requiredCategories(targetLocale).filter((category) => !supplied.has(category));
  if (missing.length === 0) {
    return undefined;
  }
  return {
    code: "PLURAL_CATEGORIES_INCOMPLETE",
    message:
      `The source does not supply all CLDR plural categories the target language "${targetLocale}" ` +
      `requires (missing: ${missing.join(", ")}); verbatra translates only the source's plural forms ` +
      "and does not synthesize the others. Add the missing forms manually.",
  };
}

/**
 * Per-base-key completeness check over a written target's keys: true when some plural base key is missing
 * a category the target language requires. Per base key, so one complete base key cannot mask another's gap.
 */
export function targetPluralSetIncomplete(
  targetKeys: Iterable<string>,
  targetLocale: string,
): boolean {
  const required = requiredCategories(targetLocale);
  const present = new Map<string, Set<CldrPluralCategory>>();
  for (const key of targetKeys) {
    const baseKey = pluralBaseKey(key);
    const category = pluralCategoryOf(key);
    if (baseKey === undefined || category === undefined) {
      continue;
    }
    const set = present.get(baseKey) ?? new Set<CldrPluralCategory>();
    set.add(category);
    present.set(baseKey, set);
  }
  for (const categories of present.values()) {
    if (required.some((category) => !categories.has(category))) {
      return true;
    }
  }
  return false;
}

/** The set of source base keys that carry at least one plural form. */
export function sourcePluralBaseKeys(source: LocaleResource): ReadonlySet<string> {
  const bases = new Set<string>();
  for (const key of source.entries.keys()) {
    const baseKey = pluralBaseKey(key);
    if (baseKey !== undefined) {
      bases.add(baseKey);
    }
  }
  return bases;
}

/** True when a target key is a plural form of a source base key (so it is generated, not orphaned). */
export function isGeneratedPluralKey(key: string, sourceBaseKeys: ReadonlySet<string>): boolean {
  const baseKey = pluralBaseKey(key);
  return baseKey !== undefined && sourceBaseKeys.has(baseKey);
}

/** A static, secret-free PLURAL_CATEGORIES_INCOMPLETE notice; the message lists no key or value. */
export function pluralIncompleteNotice(targetLocale: string): SdkNotice {
  return {
    code: "PLURAL_CATEGORIES_INCOMPLETE",
    message:
      `The plural set for the target language "${targetLocale}" is still incomplete: verbatra could not ` +
      "generate every required CLDR plural form (an unsupported case, or a generated form was withheld " +
      "for a placeholder mismatch). Add the remaining forms manually.",
  };
}

/** One plural form verbatra must generate: a derived target key drawn from a chosen source form. */
export interface PluralGenerationItem {
  /** The derived target plural key, for example `items_few`. */
  readonly targetKey: string;
  /** The CLDR category being generated, carried into the request as data context. */
  readonly category: CldrPluralCategory;
  /** The source plural entry whose value/placeholders the generated form is drawn from. */
  readonly sourceEntry: TranslationEntry;
  /** Every source plural entry of this base key, in category order, to govern lock tracking. */
  readonly governingEntries: readonly TranslationEntry[];
}

/** The plural-generation plan for one locale: the items to generate (possibly empty). */
export interface PluralGenerationPlan {
  readonly items: readonly PluralGenerationItem[];
}

/**
 * Pick the source plural entry a generated category is drawn from: prefer `other`, then `one`, then any.
 * The forms of one base key share a placeholder set, so one representative stands in for the base key.
 */
function representativeEntry(
  group: ReadonlyMap<CldrPluralCategory, TranslationEntry>,
): TranslationEntry | undefined {
  return group.get("other") ?? group.get("one") ?? [...group.values()][0];
}

/**
 * Plan plural-category generation: for each source plural base key, derive the target forms for the
 * categories the source lacks but the language requires. Unsupported cases (non-i18next, an unknown
 * language) yield an empty plan.
 */
export function planPluralGeneration(
  source: LocaleResource,
  targetLocale: string,
  format: string,
): PluralGenerationPlan {
  if (format !== "i18next-json" || !isKnownRicherLanguage(targetLocale)) {
    return { items: [] };
  }
  const required = requiredCategories(targetLocale);
  const groups = groupPluralSources(source);
  const items: PluralGenerationItem[] = [];
  for (const [baseKey, group] of groups) {
    const representative = representativeEntry(group);
    if (representative === undefined) {
      continue;
    }
    const governingEntries = [...group.values()];
    for (const category of required) {
      if (group.has(category)) {
        continue;
      }
      items.push({
        targetKey: makePluralKey(baseKey, category),
        category,
        sourceEntry: representative,
        governingEntries,
      });
    }
  }
  return { items };
}
