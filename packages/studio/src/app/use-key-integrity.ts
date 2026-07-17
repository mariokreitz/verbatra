import { useEffect, useState } from "react";
import type { KeyIntegrityLocaleEntry } from "../client/integrity-pill.js";
import { rpcClient } from "./api.js";

/** The loading, error, or loaded state of one key's integrity read. */
export type KeyIntegrityState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loaded"; readonly locales: readonly KeyIntegrityLocaleEntry[] };

/**
 * Fetches one key's placeholder or ICU integrity per target locale via
 * `key.integrity`. Re-fetches whenever `key` or `refreshToken` changes, so a
 * write that triggers a live-refresh event updates the view without the
 * caller re-mounting.
 */
export function useKeyIntegrity(key: string, refreshToken: number): KeyIntegrityState {
  const [state, setState] = useState<KeyIntegrityState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void rpcClient.call("key.integrity", { key }).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error", message: response.error.message });
        return;
      }
      setState({ kind: "loaded", locales: response.result.locales });
    });
    return () => {
      cancelled = true;
    };
  }, [key, refreshToken]);

  return state;
}
