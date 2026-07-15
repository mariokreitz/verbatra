import type { LoadedConfig } from "@verbatra/sdk";
import { STATUS_CHECK_METHOD } from "../shared/rpc/check.js";
import type { RpcMethodName, RpcParamsFor, RpcResultFor } from "../shared/rpc/contract.js";
import { STATUS_DIFF_METHOD } from "../shared/rpc/diff.js";
import { GLOSSARY_GET_METHOD } from "../shared/rpc/glossary.js";
import { HISTORY_LIST_METHOD } from "../shared/rpc/history.js";
import { KEY_INTEGRITY_METHOD } from "../shared/rpc/key-integrity.js";
import { LOCK_STATE_METHOD } from "../shared/rpc/lock.js";
import { PROJECT_SNAPSHOT_METHOD } from "../shared/rpc/snapshot.js";
import { statusCheckHandler } from "./methods/check.js";
import { statusDiffHandler } from "./methods/diff.js";
import { glossaryGetHandler } from "./methods/glossary.js";
import { historyListHandler } from "./methods/history.js";
import { keyIntegrityHandler } from "./methods/key-integrity.js";
import { lockStateHandler } from "./methods/lock.js";
import { snapshotHandler } from "./methods/snapshot.js";
import type { StudioServerDeps } from "./types.js";

/**
 * Everything an RPC handler may read: the config resolved once at startup (G11, never re-loaded
 * per request), the project root it resolves relative paths against, and the remaining
 * {@link StudioServerDeps} forwarded unchanged for handlers that need them.
 */
export interface RpcHandlerDeps
  extends Omit<StudioServerDeps, "loader" | "token" | "output" | "assetsRoot"> {
  readonly config: LoadedConfig;
  readonly projectRoot: string;
}

export type RpcHandler<M extends RpcMethodName> = (
  params: RpcParamsFor<M>,
  deps: RpcHandlerDeps,
) => Promise<RpcResultFor<M>>;

/**
 * The single handlers record. Its keys now equal the contract's full method list
 * ({@link RPC_METHOD_NAMES} in `../shared/rpc/contract.js`) exactly: every one of the seven agreed
 * methods, `project.snapshot`, `status.check`, `status.diff`, `glossary.get`, `lock.state`,
 * `history.list`, and `key.integrity`, has a real handler. A future contract method added without
 * a handler here would still dispatch to `METHOD_UNKNOWN` rather than throw, but that is no longer
 * the steady state.
 *
 * The server caches no project data between requests: `project.snapshot` only reads the config
 * resolved once at startup (see {@link RpcHandlerDeps.config}), which is the one value this whole
 * dashboard intentionally holds in memory. A handler that reads anything else from disk (the
 * status, diff, lock, history, or key-integrity views) must read it fresh on every call, never
 * caching it; `status.check`, `status.diff`, `lock.state`, `history.list`, and `key.integrity` all
 * do this, and their test files each assert a second call reflects an on-disk (or
 * on-repository) change made between two identical calls. `glossary.get` needs no such test: like
 * `project.snapshot`, it only reads fields already present on the startup-loaded config.
 */
export const rpcHandlers: { readonly [M in RpcMethodName]?: RpcHandler<M> } = {
  [PROJECT_SNAPSHOT_METHOD]: snapshotHandler,
  [STATUS_CHECK_METHOD]: statusCheckHandler,
  [STATUS_DIFF_METHOD]: statusDiffHandler,
  [GLOSSARY_GET_METHOD]: glossaryGetHandler,
  [LOCK_STATE_METHOD]: lockStateHandler,
  [HISTORY_LIST_METHOD]: historyListHandler,
  [KEY_INTEGRITY_METHOD]: keyIntegrityHandler,
};
