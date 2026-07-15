import { useEffect, useState } from "react";
import type { KeyIntegrityLocaleEntry } from "../client/integrity-pill.js";
import { rpcClient } from "./api.js";

export type KeyIntegrityState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loaded"; readonly locales: readonly KeyIntegrityLocaleEntry[] };

/**
 * Fetches one key's placeholder or ICU integrity per target locale via `key.integrity`, scoped to
 * the key currently open in {@link KeyDetailDrawer}. Re-fetches whenever `key` changes.
 */
export function useKeyIntegrity(key: string): KeyIntegrityState {
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
  }, [key]);

  return state;
}
