import { useEffect, useState } from "react";
import type { StatusData } from "../client/coverage.js";
import { toStatusOutcome } from "../client/coverage.js";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import { rpcClient } from "./api.js";

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
