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
 * Fetches the project's commit history once via `history.list` and exposes it as a
 * {@link HistoryState}, shared by every panel that shows commit history (currently
 * `HistoryPanel` and `KeyDetailDrawer`) so the fetch/state-machine logic exists in one place.
 */
export function useHistoryList(): HistoryState {
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
  }, []);

  return state;
}
