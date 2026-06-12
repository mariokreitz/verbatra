const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * True when a key uses an i18next CLDR plural suffix (_zero, _one, _two, _few,
 * _many, _other). Context suffixes (for example _male) and ordinary keys do not
 * match, so they are not misclassified as plural.
 */
export function isPluralKey(key: string): boolean {
  return PLURAL_SUFFIX.test(key);
}
