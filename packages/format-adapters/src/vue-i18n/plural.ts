/**
 * vue-i18n encodes plural forms inside one value separated by the pipe delimiter,
 * for example "no apples | one apple | {count} apples". A value is pluralized when it
 * contains a pipe; this matches vue-i18n's own default parsing, so a bare pipe in a
 * non-plural string is also classified plural (the defined behavior).
 *
 * vue-i18n encodes every CLDR category inside one value; this tests the value. Compare
 * {@link isPluralKey} in `i18next/plural.ts`, which instead tests a key for the CLDR suffix
 * i18next uses to spread a plural across sibling keys.
 */
export function isPluralValue(value: string): boolean {
  return value.includes("|");
}
