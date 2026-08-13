import type { RpcCallResult } from "./rpc-client.js";

export type KeyValueContext =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "loaded"; readonly source: string; readonly target: string | undefined };

export function deriveKeyValueContext(response: RpcCallResult<"key.value">): KeyValueContext {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  return { kind: "loaded", source: response.result.source, target: response.result.target };
}
