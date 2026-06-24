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
 * A curated, static map of language subtag to the CLDR cardinal plural categories that language
 * requires, for languages whose category set is RICHER than the {one, other} pair that English
 * and most Western European languages use. Source: the Unicode CLDR cardinal plural rules.
 * Languages not listed here are treated as {one, other}; "other" is universal and therefore
 * omitted (it is always available). This is a static lookup, NOT a CLDR plural-rule engine: the
 * only question it answers is "does the target language USE more categories than the source
 * supplied", which needs the category SET per language, not the number-to-category mapping.
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

/**
 * Group the source's i18next plural entries by base key. Non-plural keys are ignored.
 * The format-specific suffix grammar is read via the i18next adapter helpers, so the SDK
 * never encodes the `_few` suffix shape itself.
 */
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
 * Emit a per-locale notice when the TARGET language requires more CLDR plural categories than the
 * SOURCE supplies. This is the fallback for cases generation does not cover (non-i18next, DeepL, an
 * unknown language, or a withheld/partial generation). The check only applies to i18next-style sources
 * (the only v1 format whose keys encode per-category coverage); for other formats, or when the source
 * supplies no plural keys at all, no notice is produced. Returns undefined when nothing is missing.
 *
 * @param source - The source locale resource (its keys carry the plural-category suffixes).
 * @param targetLocale - The target locale being translated into.
 * @param format - The project format; the check is a no-op unless it is "i18next-json".
 * @returns A single notice when the target needs categories the source lacks, otherwise undefined.
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
 * Per-base-key completeness check over a WRITTEN target's keys (post-generation). The target plural set
 * is complete only when, for every plural base key present, every category the target language requires
 * is present. A single gap (a withheld form, or a base key generation could not cover) makes it
 * incomplete, so the caller keeps the PLURAL_CATEGORIES_INCOMPLETE warning. Unlike the source-union check
 * in {@link detectMissingPluralCategories}, this is per base key so one complete base key cannot mask
 * another's gap.
 *
 * @param targetKeys - The keys actually present in the written target file.
 * @param targetLocale - The target locale whose required category set applies.
 * @returns True when at least one plural base key is missing a required category.
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

/**
 * The set of source base keys that carry at least one plural form. A target plural key whose base is in
 * this set is a generated plural form (or a source plural form), NOT a true orphan: the source key
 * `items_few` may be absent while `items_one` / `items_other` exist. Used to keep generated plural forms
 * out of orphan pruning so they are not deleted and regenerated on the next run.
 */
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
 * Pick the source plural entry a generated category should be drawn from: prefer the `other` form
 * (the canonical fallback in CLDR), then `one`, then any present form. Groups are only ever passed
 * here when non-empty, so a form is always found.
 *
 * A single representative is sufficient because the source plural forms of one base key share the same
 * placeholder set: they are the same message rendered for different counts, so the count placeholder (and
 * any other interpolation) is common to every category. The generated form is therefore integrity-checked
 * against this one representative's placeholders, and that set stands in for the whole base key. If a real
 * source ever DID diverge across categories (for example `items_one` interpolating an extra `{{unit}}`
 * that `items_other` omits), generation validates against the chosen representative (`_other`, then
 * `_one`): a generated form that does not carry exactly that representative's placeholder set is withheld
 * by the standard integrity check, never silently written. This is intentional, not a gap: the
 * representative is the canonical form and divergent extra placeholders in a non-representative form are
 * not propagated.
 */
function representativeEntry(
  group: ReadonlyMap<CldrPluralCategory, TranslationEntry>,
): TranslationEntry | undefined {
  return group.get("other") ?? group.get("one") ?? [...group.values()][0];
}

/**
 * Plan plural-category generation for a supported case (i18next-JSON + an LLM provider + a target
 * language whose static set is richer than what the source supplies). For each source plural base key,
 * it derives the target forms for the categories the source lacks but the language requires. The result
 * never includes a category the source already supplies for that base key, so a source that is already
 * complete yields an empty plan (no spurious generation).
 *
 * Unsupported cases (non-i18next, an unknown language) yield an empty plan; the caller falls back to the
 * warning. DeepL gating is the caller's concern (this module has no provider knowledge).
 *
 * @param source - The source locale resource carrying the plural suffixes.
 * @param targetLocale - The target locale being generated into.
 * @param format - The project format; generation is a no-op unless it is "i18next-json".
 * @returns The per-base-key generation items, or an empty plan when nothing applies.
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
