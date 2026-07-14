import { useEffect, useState } from "react";
import type { StatusData } from "../client/coverage.js";
import { toStatusOutcome } from "../client/coverage.js";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import { rpcClient } from "./api.js";

/**
 * Fetches per-locale translation drift via `status.check` and exposes it as a
 * {@link RefreshableView}, shared by every panel that needs it (currently `StatusPanel` and
 * `StatusGrid`) so the fetch/state-machine logic exists in one place. Re-fetches whenever
 * `refreshToken` changes; a caller with no live-refresh signal (like `StatusGrid`, which reuses
 * the diff panel's own refresh instead) can omit it to fetch once on mount.
 */
export function useStatusData(refreshToken?: unknown): RefreshableView<StatusData> {
  const [view, setView] = useState<RefreshableView<StatusData>>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("status.check", {}).then((response) => {
      if (cancelled) {
        return;
      }
      const outcome = toStatusOutcome(response);
      setView((previous) => applyRefreshOutcome(previous, outcome));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return view;
}
