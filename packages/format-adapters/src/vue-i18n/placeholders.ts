// Single-brace tokens, with an inner class that excludes braces so a failed match
// fails fast at the next brace. This keeps extraction linear in the value length
// (no backtracking) on adversarial input. Linked messages (@:key) contain no braces
// and are therefore not matched.
const PLACEHOLDER_PATTERN = /\{[^{}]*\}/g;

/**
 * Extract vue-i18n single-brace placeholders (named {name} and list {0}, {1}) from a
 * value, verbatim and unresolved, in document order with every occurrence preserved
 * (not deduplicated). A value with no interpolation yields an empty array. Linked
 * messages such as @:other.key are not placeholders and are not extracted.
 *
 * Multiplicity is intentional: integrity is a multiset check, so a value that repeats
 * a placeholder must report each occurrence. Collapsing duplicates here would let a
 * translation that drops one occurrence pass the integrity check.
 */
export function extractVueI18nPlaceholders(value: string): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const token = match[0];
    if (token !== undefined) {
      result.push(token);
    }
  }
  return result;
}
