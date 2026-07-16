import { useEffect, useState } from "react";
import type { ReviewQueueData } from "../client/review-queue-data.js";
import { toReviewQueueOutcome } from "../client/review-queue-data.js";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import { rpcClient } from "./api.js";

/**
 * Fetches the needs-review queue via `review.queue` and exposes it as a
 * {@link RefreshableView}, keeping the last good data with a stale marker
 * when a re-fetch fails. Re-fetches whenever `refreshToken` changes.
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
