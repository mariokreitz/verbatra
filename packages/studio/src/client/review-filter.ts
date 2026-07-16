import type { ReviewQueueRow } from "./review-queue-data.js";

/** The Review queue's client-side filter state: a locale to pin, and a key substring. */
export interface ReviewFilter {
  /** Exact locale to show, or null for every locale. */
  readonly locale: string | null;
  /** Case-insensitive substring matched against the key; whitespace-only means no filtering. */
  readonly query: string;
}

/** Sorted unique locales present in the given rows, for the locale filter's option list. */
export function uniqueReviewLocales(rows: readonly ReviewQueueRow[]): readonly string[] {
  return [...new Set(rows.map((row) => row.locale))].sort();
}

/**
 * Applies a {@link ReviewFilter} to the queue's visible rows. Purely a view narrowing: it never
 * touches the session overlay (actioned rows are already removed by `visibleReviewQueueRows`
 * before this runs) and an empty filter returns the rows unchanged.
 */
export function filterReviewRows(
  rows: readonly ReviewQueueRow[],
  filter: ReviewFilter,
): readonly ReviewQueueRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filter.locale === null || row.locale === filter.locale) &&
      (query === "" || row.key.toLowerCase().includes(query)),
  );
}
