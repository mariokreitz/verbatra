import { useEffect, useState } from "react";
import type { StudioCapabilities } from "../shared/rpc/snapshot.js";
import { rpcClient } from "./api.js";

/** The loading, error, or loaded state of the capabilities read. */
export type CapabilitiesState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "loaded"; readonly capabilities: StudioCapabilities };

/**
 * Fetches the server's resolved capabilities via `project.snapshot`'s
 * `capabilities` field, once per mount. Used to hide write affordances the
 * server would refuse anyway; never treated as an authorization check on its
 * own.
 */
export function useCapabilities(): CapabilitiesState {
  const [state, setState] = useState<CapabilitiesState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void rpcClient.call("project.snapshot", {}).then((response) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setState({ kind: "error" });
        return;
      }
      setState({ kind: "loaded", capabilities: response.result.capabilities });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
