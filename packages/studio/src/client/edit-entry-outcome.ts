import type { RpcCallResult } from "./rpc-client.js";

/**
 * The three outcomes a `translation.editEntry` call can settle to, ready to render. Unlike
 * `RetranslateOutcome`, there is no `reviewReasons` field on the success arm: `editEntry` never
 * calls a provider, so there is no provider-derived review signal to carry.
 */
export type EditEntryOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "rejected"; readonly reason: "placeholder" | "icu" }
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
