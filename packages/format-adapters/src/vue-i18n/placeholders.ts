// Single-brace tokens, with an inner class that excludes braces so a failed match
// fails fast at the next brace. This keeps extraction linear in the value length
// (no backtracking) on adversarial input. Linked messages (@:key) contain no braces
// and are therefore not matched.
const PLACEHOLDER_PATTERN = /\{[^{}]*\}/g;

/**
 * Extract vue-i18n single-brace placeholders (named {name} and list {0}, {1}) from a
 * value, verbatim and unresolved, deduplicated in first-appearance order. A value
 * with no interpolation yields an empty array. Linked messages such as @:other.key
 * are not placeholders and are not extracted.
 */
export function extractVueI18nPlaceholders(value: string): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const token = match[0];
    if (token !== undefined && !seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}
