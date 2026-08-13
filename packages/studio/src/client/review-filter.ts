import type { ReviewQueueRow } from "./review-queue-data.js";

export interface ReviewFilter {
  readonly locale: string | null;
  readonly query: string;
}

export function uniqueReviewLocales(rows: readonly ReviewQueueRow[]): readonly string[] {
  return [...new Set(rows.map((row) => row.locale))].sort();
}

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
