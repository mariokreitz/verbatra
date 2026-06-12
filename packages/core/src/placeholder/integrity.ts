import type { PlaceholderIntegrityResult } from "./types.js";

function difference(a: readonly string[], b: ReadonlySet<string>): readonly string[] {
  return [...new Set(a.filter((item) => !b.has(item)))].sort();
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Compare a source placeholder set against the placeholders found in a
 * translated value. Reports which placeholders are missing, which are extra, and
 * whether an otherwise-matching set was reordered. Never throws on a mismatch.
 */
export function checkPlaceholders(
  source: readonly string[],
  translated: readonly string[],
): PlaceholderIntegrityResult {
  const sourceSet = new Set(source);
  const translatedSet = new Set(translated);

  const missing = difference(source, translatedSet);
  const extra = difference(translated, sourceSet);
  const reordered = missing.length === 0 && extra.length === 0 && !sameOrder(source, translated);

  return {
    matches: missing.length === 0 && extra.length === 0 && !reordered,
    missing,
    extra,
    reordered,
  };
}
