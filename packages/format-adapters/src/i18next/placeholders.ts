// The brace-excluding inner class keeps matching linear (no backtracking) on adversarial input.
const DOUBLE_BRACE_PATTERN = /\{\{[^{}]*\}\}/g;

// Adds i18next $t() nesting references. The parenthesis-excluding inner class keeps matching
// linear, so nested parentheses inside options are unsupported and only the "$t(" prefix is matched.
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
 * Extract i18next double-brace interpolation tokens ({{name}}, {{val, number}}), without $t()
 * nesting. Shared with ngx-translate. Tokens are verbatim and unresolved, in document order with
 * every occurrence preserved (not deduplicated).
 */
export function extractDoubleBracePlaceholders(value: string): readonly string[] {
  return scanTokens(value, DOUBLE_BRACE_PATTERN);
}

/**
 * Extract i18next placeholders: double-brace interpolation ({{name}}, {{val, number}}) and nesting
 * references ($t(common.foo), $t(common.foo, { options })), verbatim and unresolved, in document
 * order with every occurrence preserved (not deduplicated). A value with no placeholders yields an
 * empty array. Nested parentheses inside $t() options are not supported, and only the default "$t("
 * prefix is recognized.
 */
export function extractI18nextPlaceholders(value: string): readonly string[] {
  return scanTokens(value, I18NEXT_PATTERN);
}
