// XLIFF inline placeholder elements (x, g, bx, ex, ph, it, mrk) carry ids and must survive
// translation, so their opening tags are treated as placeholder tokens alongside a baseline
// single-brace {name} text scan. The name alternation is followed by "\b" so an element whose name
// merely starts with one of these letters (for example <source>) does not match. The "[^>]*" inner
// class excludes ">" and "{[^{}]+}" excludes braces, so extraction stays linear (no backtracking)
// even on adversarial input.
const XLIFF_PATTERN = /<(?:x|g|bx|ex|ph|it|mrk)\b[^>]*>|\{[^{}]+\}/g;

/**
 * Extract XLIFF placeholder tokens from a value: the opening tags of inline placeholder elements
 * (which carry the ids that must round-trip) and single-brace `{name}` text interpolation, verbatim
 * and unresolved, in document order with every occurrence preserved (not deduplicated) so the
 * integrity multiset check sees true counts.
 *
 * @param value - The XLIFF unit value (its inner markup) to scan.
 * @returns The placeholder tokens found, in document order.
 */
export function extractXliffPlaceholders(value: string): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(XLIFF_PATTERN)) {
    const token = match[0];
    if (token !== undefined) {
      result.push(token);
    }
  }
  return result;
}
