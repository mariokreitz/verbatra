// The inner class excludes braces so a failed match fails fast at the next brace.
// This keeps extraction linear in the value length (no backtracking) even on
// adversarial input such as a long run of "{{" with no closing "}}". i18next
// interpolation tokens never contain braces, so well-formed values are unaffected.
const PLACEHOLDER_PATTERN = /\{\{[^{}]*\}\}/g;

/**
 * Extract i18next double-brace placeholders (for example {{name}}, {{count}},
 * {{val, number}}) from a value, verbatim and unresolved, in document order with
 * every occurrence preserved (not deduplicated). A value with no placeholders
 * yields an empty array.
 *
 * Multiplicity is intentional: integrity is a multiset check, so a value like
 * "{{count}} of {{count}}" must report two occurrences. Collapsing duplicates here
 * would let a translation that drops one occurrence pass the integrity check.
 */
export function extractI18nextPlaceholders(value: string): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const token = match[0];
    if (token !== undefined) {
      result.push(token);
    }
  }
  return result;
}
