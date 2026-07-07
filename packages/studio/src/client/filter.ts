/** The maximum number of keys a single list renders in the browser (G24). */
export const MAX_RENDERED_KEYS = 500;

/** One key list, filtered and capped for rendering. */
export interface CappedKeyList {
  /** The keys to render: at most {@link MAX_RENDERED_KEYS}, in the order they arrived. */
  readonly items: readonly string[];
  /** How many keys matched the query before capping. */
  readonly totalMatches: number;
  /** True when `totalMatches` exceeds {@link MAX_RENDERED_KEYS}, i.e. the rendered list was cut off. */
  readonly truncated: boolean;
}

/**
 * Filters a full in-memory key list by a case-insensitive substring query, then caps the render
 * at {@link MAX_RENDERED_KEYS}. The filter always runs over the full list passed in, never a
 * pre-truncated one, so a narrow query can surface a match past the first 500 unfiltered keys.
 * Keys arrive already sorted from the core diff, so this never re-sorts; `items` preserves the
 * input order for whichever keys matched.
 */
export function filterAndCapKeys(keys: readonly string[], query: string): CappedKeyList {
  const needle = query.trim().toLowerCase();
  const matches = needle === "" ? keys : keys.filter((key) => key.toLowerCase().includes(needle));
  return {
    items: matches.slice(0, MAX_RENDERED_KEYS),
    totalMatches: matches.length,
    truncated: matches.length > MAX_RENDERED_KEYS,
  };
}
