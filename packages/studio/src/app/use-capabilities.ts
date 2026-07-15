import { useEffect, useState } from "react";
import type { StudioCapabilities } from "../shared/rpc/snapshot.js";
import { rpcClient } from "./api.js";

export type CapabilitiesState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "loaded"; readonly capabilities: StudioCapabilities };

/**
 * Fetches the server's resolved write capabilities via `project.snapshot`'s `capabilities` field,
 * an independent, stateless read made fresh on every mount, mirroring how `OverviewPanel` already
 * reads the same snapshot. This is a defense-in-depth projection only, used to hide a write
 * affordance the server would refuse anyway (an absent handler answers `METHOD_UNKNOWN`); it is
 * never treated as an authorization check on its own.
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
