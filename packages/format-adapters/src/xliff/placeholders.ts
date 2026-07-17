/**
 * Opening tags of XLIFF inline placeholder elements plus single-brace interpolation. The `\b` stops
 * a name-prefixed element such as `<source>` from matching, and the character classes keep matching
 * linear (no catastrophic backtracking) on adversarial input.
 */
const XLIFF_PATTERN = /<(?:x|g|bx|ex|ph|it|mrk)\b[^>]*>|\{[^{}]+\}/g;

/**
 * Extract XLIFF placeholder tokens: the opening tags of inline placeholder elements and single-brace
 * `{name}` interpolation, verbatim and in document order with every occurrence preserved.
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
