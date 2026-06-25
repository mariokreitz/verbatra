// vue-i18n named ({name}) and list ({0}) interpolation tokens. A named key starts with a
// letter or underscore, then letters, digits, underscores, hyphens, or dollar signs; a list
// key is digits. vue-i18n's compiler skips whitespace inside the braces, so "{ name }" and
// "{name}" are the same token and are normalized to "{name}" here.
//
// The lookbehind/lookahead reject a brace that is part of a "{{...}}" pair. vue-i18n has no
// double-brace syntax (a literal brace is written {'{'}), so a value like "{{name}}" must not
// yield a phantom "{name}". Literal interpolation ({'...'}) is a constant, not a variable, and
// is intentionally not matched. The key classes are disjoint from whitespace, so there is no
// backtracking: extraction stays linear in the value length even on adversarial input.
const PLACEHOLDER_PATTERN = /(?<!\{)\{\s*([A-Za-z_][\w$-]*|\d+)\s*\}(?!\})/g;

/**
 * Extract vue-i18n single-brace placeholders (named {name} and list {0}, {1}) from a value,
 * unresolved and normalized to a canonical `{key}` token (surrounding whitespace removed), in
 * document order with every occurrence preserved (not deduplicated). A value with no
 * interpolation yields an empty array. Linked messages (@:other.key), literal interpolation
 * ({'...'}), and double-brace text ({{...}}) are not placeholders and are not extracted.
 *
 * Multiplicity is intentional: integrity is a multiset check, so a value that repeats a
 * placeholder must report each occurrence. Collapsing duplicates here would let a translation
 * that drops one occurrence pass the integrity check.
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
