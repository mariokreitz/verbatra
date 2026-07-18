import type { IntegrityGateReason } from "@verbatra/sdk";
import type { RpcCallResult } from "./rpc-client.js";

/**
 * The three outcomes a `translation.editEntry` call can settle to, ready to render. Structurally
 * identical to `RetranslateOutcome`; the underlying RPC results differ (`EditEntryResult` carries
 * no `reviewReasons`, since `editEntry` never calls a provider), but neither derived outcome
 * keeps any per-result extras.
 */
export type EditEntryOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "rejected"; readonly reason: IntegrityGateReason }
  | { readonly kind: "error"; readonly message: string };

/**
 * Derives the render-ready outcome from a `translation.editEntry` RPC response, mirroring
 * `deriveRetranslateOutcome` exactly: a transport/domain error (`ok: false`) and an
 * accepted-but-rejected candidate (`ok: true`, `accepted: false`) are both failures a caller must
 * distinguish in its own wording, so they are kept as separate outcome kinds rather than collapsed
 * into one generic "error".
 */
export function deriveEditEntryOutcome(
  response: RpcCallResult<"translation.editEntry">,
): EditEntryOutcome {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  if (!response.result.accepted) {
    return { kind: "rejected", reason: response.result.reason };
  }
  return { kind: "success" };
}
