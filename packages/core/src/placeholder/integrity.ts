import type { PlaceholderIntegrityResult } from "./types.js";

function difference(a: readonly string[], b: ReadonlySet<string>): readonly string[] {
  return [...new Set(a.filter((item) => !b.has(item)))].sort();
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Compare a source placeholder set against the placeholders found in a translated value, reporting
 * which placeholders are missing, which are extra, and whether an otherwise-matching set was
 * reordered. It does not throw; a mismatch is reported in the result, not raised.
 *
 * @param source - The placeholders present in the source value.
 * @param translated - The placeholders present in the translated value.
 * @returns The integrity result: whether the sets match, plus the missing, extra, and reordered details.
 * @example
 * ```ts
 * checkPlaceholders(["{name}"], ["{name}"]); // { matches: true, ... }
 * checkPlaceholders(["{a}", "{b}"], ["{b}", "{a}"]); // { matches: false, reordered: true, ... }
 * ```
 */
export function checkPlaceholders(
  source: readonly string[],
  translated: readonly string[],
): PlaceholderIntegrityResult {
  const sourceSet = new Set(source);
  const translatedSet = new Set(translated);

  const missing = difference(source, translatedSet);
  const extra = difference(translated, sourceSet);
  // Reordering is reported as its own category, distinct from a clean match: for positional
  // placeholders (e.g. %s / {0}) the order carries meaning, so the same set in a different order
  // can still be wrong. The caller decides whether order matters for its format.
  const reordered = missing.length === 0 && extra.length === 0 && !sameOrder(source, translated);

  return {
    matches: missing.length === 0 && extra.length === 0 && !reordered,
    missing,
    extra,
    reordered,
  };
}
