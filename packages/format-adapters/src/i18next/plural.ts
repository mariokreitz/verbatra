/** The six CLDR cardinal plural categories i18next encodes as key suffixes. */
export type I18nextPluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * True when a key uses an i18next CLDR plural suffix (_zero, _one, _two, _few,
 * _many, _other). Context suffixes (for example _male) and ordinary keys do not
 * match, so they are not misclassified as plural.
 */
export function isPluralKey(key: string): boolean {
  return PLURAL_SUFFIX.test(key);
}

/**
 * The CLDR plural category a key encodes, or undefined when the key carries no
 * plural suffix. Format knowledge of the suffix grammar lives here, not in callers.
 */
export function pluralCategoryOf(key: string): I18nextPluralCategory | undefined {
  const match = PLURAL_SUFFIX.exec(key);
  return match?.[1] as I18nextPluralCategory | undefined;
}

/**
 * The base of a plural key with its CLDR suffix removed (for example
 * `items_one` -> `items`, `a.b.items_other` -> `a.b.items`). Returns undefined
 * for a key that is not a plural key, so callers cannot fabricate a base from a
 * non-plural key.
 */
export function pluralBaseKey(key: string): string | undefined {
  if (!isPluralKey(key)) {
    return undefined;
  }
  return key.replace(PLURAL_SUFFIX, "");
}

/**
 * Compose the i18next plural key for a base key and a CLDR category (for example
 * `items` + `few` -> `items_few`). The inverse of {@link pluralBaseKey}; the suffix
 * grammar stays owned by this format adapter rather than leaking into the SDK.
 */
export function makePluralKey(baseKey: string, category: I18nextPluralCategory): string {
  return `${baseKey}_${category}`;
}
