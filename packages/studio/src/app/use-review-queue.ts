import { useEffect, useState } from "react";
import type { ReviewQueueData } from "../client/review-queue-data.js";
import { toReviewQueueOutcome } from "../client/review-queue-data.js";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import { rpcClient } from "./api.js";

/**
 * Fetches the needs-review queue's view half via `review.queue` and exposes it as a
 * {@link RefreshableView}, mirroring `useStatusData` exactly. Re-fetches whenever `refreshToken`
 * changes, including the existing SSE `refresh` event `App` already threads into every panel: an
 * edit, a retranslate, or an external file change all reach this the same way.
 */
export function useReviewQueue(refreshToken?: unknown): RefreshableView<ReviewQueueData> {
  const [view, setView] = useState<RefreshableView<ReviewQueueData>>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("review.queue", {}).then((response) => {
      if (cancelled) {
        return;
      }
      const outcome = toReviewQueueOutcome(response);
      setView((previous) => applyRefreshOutcome(previous, outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return view;
}
