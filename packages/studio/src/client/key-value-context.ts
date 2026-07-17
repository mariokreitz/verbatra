import type { RpcCallResult } from "./rpc-client.js";

/**
 * The edit dialog's context state, derived from a `key.value` call: still loading, a transport or
 * domain error, or the loaded current source and target (`target` is `undefined` exactly when the
 * key does not yet exist in that target locale, mirroring `KeyValueResult`'s own sparse-locale
 * convention).
 */
export type KeyValueContext =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loaded"; readonly source: string; readonly target: string | undefined };

/**
 * Derives the edit dialog's context state from a `key.value` RPC response, mirroring
 * `deriveEditEntryOutcome`'s shape. Kept as a pure function, separate from the fetch effect that
 * calls it, so the mapping itself (in particular, that an absent `target` field is preserved as
 * `undefined` rather than coerced to an empty string) is directly testable without a render
 * harness.
 */
export function deriveKeyValueContext(response: RpcCallResult<"key.value">): KeyValueContext {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  return { kind: "loaded", source: response.result.source, target: response.result.target };
}
