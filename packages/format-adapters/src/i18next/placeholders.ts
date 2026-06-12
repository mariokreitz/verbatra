// The inner class excludes braces so a failed match fails fast at the next brace.
// This keeps extraction linear in the value length (no backtracking) even on
// adversarial input such as a long run of "{{" with no closing "}}". i18next
// interpolation tokens never contain braces, so well-formed values are unaffected.
const PLACEHOLDER_PATTERN = /\{\{[^{}]*\}\}/g;

/**
 * Extract i18next double-brace placeholders (for example {{name}}, {{count}},
 * {{val, number}}) from a value, verbatim and unresolved, deduplicated in order
 * of first appearance. A value with no placeholders yields an empty array.
 */
export function extractI18nextPlaceholders(value: string): readonly string[] {
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
