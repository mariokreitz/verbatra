import type { PlaceholderIntegrityResult } from "./types.js";

function counts(items: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return map;
}

/**
 * Multiset difference: every token whose count in `a` exceeds its count in `b`, emitted once
 * per surplus occurrence so a dropped/duplicated placeholder carries its multiplicity. The
 * result is sorted for deterministic output.
 */
function multisetExcess(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): string[] {
  const excess: string[] = [];
  for (const [token, count] of a) {
    const surplus = count - (b.get(token) ?? 0);
    for (let i = 0; i < surplus; i += 1) {
      excess.push(token);
    }
  }
  return excess.sort();
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Compare source placeholders against the placeholders found in a translated value as MULTISETS,
 * reporting which placeholders are missing, which are extra, and whether an otherwise-matching
 * multiset was merely reordered. Counts matter: a dropped occurrence lands in `missing` and a
 * surplus occurrence lands in `extra`, each repeated by its multiplicity, so a duplicated or
 * dropped placeholder is never misreported as a pure reorder. It does not throw; a mismatch is
 * reported in the result, not raised.
 *
 * @param source - The placeholders present in the source value.
 * @param translated - The placeholders present in the translated value.
 * @returns The integrity result: whether the multisets match, plus the missing, extra, and reordered details.
 * @example
 * ```ts
 * checkPlaceholders(["{name}"], ["{name}"]); // { matches: true, ... }
 * checkPlaceholders(["{a}", "{b}"], ["{b}", "{a}"]); // { matches: false, reordered: true, ... }
 * checkPlaceholders(["{a}", "{a}"], ["{a}"]); // { matches: false, missing: ["{a}"], ... }
 * ```
 */
export function checkPlaceholders(
  source: readonly string[],
  translated: readonly string[],
): PlaceholderIntegrityResult {
  const sourceCounts = counts(source);
  const translatedCounts = counts(translated);

  const missing = multisetExcess(sourceCounts, translatedCounts);
  const extra = multisetExcess(translatedCounts, sourceCounts);
  // Reordering is reported as its own category, distinct from a clean match: for positional
  // placeholders (e.g. %s / {0}) the order carries meaning, so the same multiset in a different
  // order can still be wrong. It applies only when nothing is missing or extra (same multiset).
  const reordered = missing.length === 0 && extra.length === 0 && !sameOrder(source, translated);

  return {
    matches: missing.length === 0 && extra.length === 0 && !reordered,
    missing,
    extra,
    reordered,
  };
}
