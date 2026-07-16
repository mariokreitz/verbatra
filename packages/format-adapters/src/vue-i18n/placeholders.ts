/**
 * vue-i18n named (`{name}`) and list (`{0}`) interpolation tokens, captured for normalization to
 * `{key}` since the compiler skips inner whitespace. The lookbehind/lookahead reject a brace from a
 * `{{...}}` pair (vue-i18n has no double-brace syntax). The key classes are disjoint from
 * whitespace, so matching stays linear (no backtracking) on adversarial input.
 */
const PLACEHOLDER_PATTERN = /(?<!\{)\{\s*([A-Za-z_][\w$-]*|\d+)\s*\}(?!\})/g;

/**
 * Extract vue-i18n single-brace placeholders (named {name} and list {0}, {1}) from a value,
 * unresolved and normalized to a canonical `{key}` token (surrounding whitespace removed), in
 * document order with every occurrence preserved (not deduplicated). A value with no
 * interpolation yields an empty array. Linked messages (@:other.key), literal interpolation
 * ({'...'}), and double-brace text ({{...}}) are not placeholders and are not extracted.
 */
export function extractVueI18nPlaceholders(value: string): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1];
    if (key !== undefined) {
      result.push(`{${key}}`);
    }
  }
  return result;
}
