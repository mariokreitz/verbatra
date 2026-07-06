import type { LoadedConfig } from "@verbatra/sdk";
import type { RpcMethodName, RpcParamsFor, RpcResultFor } from "../shared/rpc/contract.js";
import { PROJECT_SNAPSHOT_METHOD } from "../shared/rpc/snapshot.js";
import { snapshotHandler } from "./methods/snapshot.js";
import type { UiServerDeps } from "./types.js";

/**
 * Everything an RPC handler may read: the config resolved once at startup (G11, never re-loaded
 * per request), the project root it resolves relative paths against, and the remaining
 * {@link UiServerDeps} forwarded unchanged for handlers that need them.
 */
export interface RpcHandlerDeps
  extends Omit<UiServerDeps, "loader" | "token" | "output" | "assetsRoot"> {
  readonly config: LoadedConfig;
  readonly projectRoot: string;
}

export type RpcHandler<M extends RpcMethodName> = (
  params: RpcParamsFor<M>,
  deps: RpcHandlerDeps,
) => Promise<RpcResultFor<M>>;

/**
 * The single handlers record. Its keys are always a subset of the contract's method list
 * ({@link RPC_METHOD_NAMES} in `../shared/rpc/contract.js`); a contract method with no entry here
 * dispatches to `METHOD_UNKNOWN` rather than throwing. Only `project.snapshot` has a real handler
 * so far; the remaining five are later tickets' handlers.
 *
 * The server caches no project data between requests: `project.snapshot` only reads the config
 * resolved once at startup (see {@link RpcHandlerDeps.config}), which is the one value this whole
 * dashboard intentionally holds in memory. A handler that reads anything else from disk (the
 * status, diff, lock, or history views) must read it fresh on every call, never caching it; add a
 * test for that once such a handler exists (for example, edit the on-disk fixture between two
 * identical calls and assert the second response reflects the edit). There is nothing to test for
 * that yet, since no handler reads anything but the startup config.
 */
export const rpcHandlers: { readonly [M in RpcMethodName]?: RpcHandler<M> } = {
  [PROJECT_SNAPSHOT_METHOD]: snapshotHandler,
};
