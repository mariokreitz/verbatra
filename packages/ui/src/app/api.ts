/**
 * The single rpc client and session store instance the whole app shares, wired to the real
 * browser `fetch`. Kept deliberately thin: the actual client and session-expiry logic live in
 * `src/client/` (covered by the coverage gate); this module only supplies the DOM-backed `fetch`.
 */
import type { FetchLike, RpcClient } from "../client/rpc-client.js";
import { createRpcClient } from "../client/rpc-client.js";
import { createSessionStore, type SessionStore } from "../client/state.js";

const browserFetch: FetchLike = fetch;

export const sessionStore: SessionStore = createSessionStore();

export const rpcClient: RpcClient = createRpcClient({
  fetchImpl: browserFetch,
  session: sessionStore,
});
