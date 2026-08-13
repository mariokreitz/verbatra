export const MAX_RENDERED_KEYS = 500;

export interface CappedKeyList {
  readonly items: readonly string[];
  readonly totalMatches: number;
  readonly truncated: boolean;
}

export function filterAndCapKeys(keys: readonly string[], query: string): CappedKeyList {
  const needle = query.trim().toLowerCase();
  const matches = needle === "" ? keys : keys.filter((key) => key.toLowerCase().includes(needle));
  return {
    items: matches.slice(0, MAX_RENDERED_KEYS),
    totalMatches: matches.length,
    truncated: matches.length > MAX_RENDERED_KEYS,
  };
}
