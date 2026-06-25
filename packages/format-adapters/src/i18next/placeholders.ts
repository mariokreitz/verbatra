// The double-brace interpolation primitive, shared with ngx-translate. The inner class excludes
// braces so a failed match fails fast at the next brace, keeping extraction linear in the value
// length (no backtracking) even on adversarial input such as a long run of "{{" with no closing
// "}}". i18next interpolation tokens never contain braces, so well-formed values are unaffected.
const DOUBLE_BRACE_PATTERN = /\{\{[^{}]*\}\}/g;

// i18next also supports nesting: $t(key) and $t(key, { options }) splice another key's resolved
// content into the value, so the whole reference is a dependency that must survive translation
// verbatim. It is treated as a placeholder and guarded by the integrity check. The inner class
// "[^()]*" excludes parentheses so a failed match fails fast at the next "(", keeping extraction
// linear even on a long run of unclosed "$t(" (it still admits the JSON braces and commas of an
// options object). Nested parentheses inside options are therefore not supported (a documented
// limitation), and only the default "$t(" prefix is recognized. The two alternatives are scanned
// together so tokens are returned in document order with multiplicity.
const I18NEXT_PATTERN = /\{\{[^{}]*\}\}|\$t\([^()]*\)/g;

function scanTokens(value: string, pattern: RegExp): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    if (token !== undefined) {
      result.push(token);
    }
  }
  return result;
}

/**
 * Extract i18next double-brace interpolation tokens only (for example {{name}}, {{count}},
 * {{val, number}}), without i18next nesting. Shared with ngx-translate, whose interpolation is the
 * same double-brace syntax but which has no $t() nesting. Tokens are verbatim and unresolved, in
 * document order with every occurrence preserved (not deduplicated).
 */
export function extractDoubleBracePlaceholders(value: string): readonly string[] {
  return scanTokens(value, DOUBLE_BRACE_PATTERN);
}

/**
 * Extract i18next placeholders: double-brace interpolation ({{name}}, {{val, number}}) and nesting
 * references ($t(common.foo), $t(common.foo, { options })), verbatim and unresolved, in document
 * order with every occurrence preserved (not deduplicated). A value with no placeholders yields an
 * empty array.
 *
 * Multiplicity is intentional: integrity is a multiset check, so a value like "{{count}} of
 * {{count}}" must report two occurrences. Collapsing duplicates here would let a translation that
 * drops one occurrence pass the integrity check.
 *
 * Nesting references are guarded too: a translation that drops, alters, or translates a $t(...)
 * reference changes which message is composed at runtime, so the reference must be preserved
 * verbatim. Nested parentheses inside $t() options are not supported, and only the default "$t("
 * prefix is recognized.
 */
export function extractI18nextPlaceholders(value: string): readonly string[] {
  return scanTokens(value, I18NEXT_PATTERN);
}
