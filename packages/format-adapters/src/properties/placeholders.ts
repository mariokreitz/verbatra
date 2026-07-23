/**
 * Java/Spring `.properties` interpolation tokens, both positional (`{0}`, `{1}`) and named
 * (`{name}`). The lookbehind and lookahead reject a brace that belongs to a `{{...}}` pair so
 * literal double braces are never mistaken for a placeholder. The key classes are disjoint from
 * whitespace, so matching stays linear (no backtracking) on adversarial input.
 */
const PLACEHOLDER_PATTERN = /(?<!\{)\{\s*([A-Za-z_][\w$-]*|\d+)\s*\}(?!\})/g;

/**
 * Extract `.properties` single-brace placeholders (positional {0}, {1} and named {name}) from a
 * value, normalized to a canonical `{key}` token with surrounding whitespace removed, in document
 * order with every occurrence preserved (not deduplicated), since placeholder integrity is a
 * multiset. A value with no interpolation yields an empty array. Double-brace text ({{...}}) is not
 * a placeholder and is not extracted.
 */
export function extractPropertiesPlaceholders(value: string): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1];
    if (key !== undefined) {
      result.push(`{${key}}`);
    }
  }
  return result;
}
