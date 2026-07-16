import { useEffect, useState } from "react";
import type { StructuredError } from "../client/state.js";
import type { HistoryCommit } from "../shared/rpc/history.js";
import { rpcClient } from "./api.js";

export type HistoryState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly error: StructuredError }
  | { readonly kind: "unavailable" }
  | { readonly kind: "loaded"; readonly commits: readonly HistoryCommit[] };

/**
 * Fetches the project's commit history via `history.list` and exposes it as a
 * {@link HistoryState}, shared by every surface that shows commit history (the Activity feed
 * and `KeyDetailDrawer`) so the fetch/state-machine logic exists in one place. Pass the app's
 * `refreshToken` to re-fetch on every live-refresh event; omit it to fetch once on mount.
 */
export function useHistoryList(refreshToken?: unknown): HistoryState {
  const [state, setState] = useState<HistoryState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("history.list", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error", error: response.error });
        return;
      }
      if (!response.result.available) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({ kind: "loaded", commits: response.result.commits });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  return state;
}
