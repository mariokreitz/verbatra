import { useEffect, useState } from "react";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import type { UsageTickerData } from "../client/usage-ticker-data.js";
import { toUsageTickerOutcome } from "../client/usage-ticker-data.js";
import { rpcClient } from "./api.js";

/**
 * Fetches the run's persisted token/budget snapshot via `usage.summary` and exposes it as a
 * {@link RefreshableView}, mirroring `useReviewQueue` exactly. Re-fetches whenever `refreshToken`
 * changes, including the existing SSE `refresh` event `App` already threads into every panel: a
 * sdk translate or watch run, whether triggered from the CLI or Studio's own
 * `translation.translatePending`, reaches this the same way; opening or reloading Studio itself
 * does not change what the ticker shows until the next live-refresh fetch completes.
 */
export function useUsageTicker(refreshToken?: unknown): RefreshableView<UsageTickerData> {
  const [view, setView] = useState<RefreshableView<UsageTickerData>>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("usage.summary", {}).then((response) => {
      if (cancelled) {
        return;
      }
      const outcome = toUsageTickerOutcome(response);
      setView((previous) => applyRefreshOutcome(previous, outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return view;
}
