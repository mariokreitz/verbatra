import type { RpcCallResult } from "./rpc-client.js";

/** The three outcomes a `translation.retranslateEntry` call can settle to, ready to render. */
export type RetranslateOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "rejected"; readonly reason: "placeholder" | "icu" }
  | { readonly kind: "error"; readonly message: string };

/**
 * Derives the render-ready outcome from a `translation.retranslateEntry` RPC response: a
 * transport/domain error (`ok: false`) and an accepted-but-rejected candidate (`ok: true`,
 * `accepted: false`) are both failures a caller must distinguish in its own wording, so they are
 * kept as separate outcome kinds rather than collapsed into one generic "error".
 */
export function deriveRetranslateOutcome(
  response: RpcCallResult<"translation.retranslateEntry">,
): RetranslateOutcome {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  if (!response.result.accepted) {
    return { kind: "rejected", reason: response.result.reason };
  }
  return { kind: "success" };
}
