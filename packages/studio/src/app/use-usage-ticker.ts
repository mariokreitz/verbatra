import { useEffect, useState } from "react";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import type { UsageTickerData } from "../client/usage-ticker-data.js";
import { toUsageTickerOutcome } from "../client/usage-ticker-data.js";
import { rpcClient } from "./api.js";

/**
 * Fetches the last run's persisted token and budget snapshot via
 * `usage.summary` and exposes it as a {@link RefreshableView}, keeping the
 * last good data with a stale marker when a re-fetch fails. Re-fetches
 * whenever `refreshToken` changes.
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
