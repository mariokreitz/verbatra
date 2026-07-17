import type { ReviewReasonCode } from "@verbatra/sdk";
import type { RpcResultFor } from "../shared/rpc/contract.js";
import type { ReviewOverlayEntry, ReviewOverlayStore } from "./review-overlay.js";
import type { RpcCallResult } from "./rpc-client.js";
import type { FetchOutcome } from "./state.js";

/** The raw `review.queue` result: `{ available: false }` or the persisted per-locale snapshot. */
export type ReviewQueueData = RpcResultFor<"review.queue">;

/** One flagged `(locale, key)` pair, ready to render, carrying every reason code that applies. */
export interface ReviewQueueRow extends ReviewOverlayEntry {
  readonly reasons: readonly ReviewReasonCode[];
}

/**
 * Flattens the persisted per-locale snapshot into one row per flagged `(locale, key)` pair,
 * passing each key's name and reason codes through unmodified: no new computation, matching
 * acceptance criterion 1. `{ available: false }` (no run has ever persisted a snapshot, or the
 * file is missing, corrupt, or at an unrecognized version) flattens to an empty list; the caller
 * distinguishes that case from "available but nothing flagged" using `data.available` directly,
 * so it can render a distinct informational empty state rather than a generic empty table.
 */
export function flattenReviewQueue(data: ReviewQueueData): readonly ReviewQueueRow[] {
  if (!data.available) {
    return [];
  }
  const rows: ReviewQueueRow[] = [];
  for (const locale of data.locales) {
    for (const entry of locale.needsReview) {
      rows.push({ locale: locale.locale, key: entry.key, reasons: entry.reasons });
    }
  }
  return rows;
}

/**
 * The rows a fresh `review.queue` read should actually render: every flagged row, minus whatever
 * the session's {@link ReviewOverlayStore} already marked actioned (approved, rejected, or
 * successfully edited). Applied on top of every fetch, including one triggered by the existing SSE
 * `refresh` event, so an actioned row does not silently reappear the moment live refresh fires.
 */
export function visibleReviewQueueRows(
  data: ReviewQueueData,
  overlay: ReviewOverlayStore,
): readonly ReviewQueueRow[] {
  return flattenReviewQueue(data).filter((row) => !overlay.isActioned(row));
}

/**
 * Maps one `review.queue` rpc outcome to the generic {@link FetchOutcome} shape
 * `applyRefreshOutcome` (see `client/state.ts`) expects, so the queue view's stale-data behavior
 * goes through that one covered reducer, matching `toStatusOutcome`'s existing precedent.
 */
export function toReviewQueueOutcome(
  response: RpcCallResult<"review.queue">,
): FetchOutcome<ReviewQueueData> {
  if (!response.ok) {
    return { ok: false, error: response.error };
  }
  return { ok: true, result: response.result };
}
