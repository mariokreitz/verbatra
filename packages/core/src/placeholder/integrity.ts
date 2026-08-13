import type { PlaceholderIntegrityResult } from "./types.js";

function counts(items: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return map;
}

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

export function checkPlaceholders(
  source: readonly string[],
  translated: readonly string[],
): PlaceholderIntegrityResult {
  const sourceCounts = counts(source);
  const translatedCounts = counts(translated);

  const missing = multisetExcess(sourceCounts, translatedCounts);
  const extra = multisetExcess(translatedCounts, sourceCounts);
  const reordered = missing.length === 0 && extra.length === 0 && !sameOrder(source, translated);

  return {
    matches: missing.length === 0 && extra.length === 0,
    missing,
    extra,
    reordered,
  };
}
