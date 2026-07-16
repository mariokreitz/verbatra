import { useEffect, useState } from "react";
import type { StatusData } from "../client/coverage.js";
import { toStatusOutcome } from "../client/coverage.js";
import type { RefreshableView } from "../client/state.js";
import { applyRefreshOutcome } from "../client/state.js";
import { rpcClient } from "./api.js";

/**
 * Fetches per-locale translation drift via `status.check` and exposes it as a
 * {@link RefreshableView}, shared by every surface that needs it (the Translations banner and
 * locales table, and `StatusGrid`'s header coverage bars) so the fetch/state-machine logic
 * exists in one place. Re-fetches whenever `refreshToken` changes; omitting the token fetches
 * once on mount, for a caller with no live-refresh signal.
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
