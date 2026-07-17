import type { LoadedConfig } from "@verbatra/sdk";
import { STATUS_CHECK_METHOD } from "../shared/rpc/check.js";
import type { RpcMethodName, RpcParamsFor, RpcResultFor } from "../shared/rpc/contract.js";
import { STATUS_DIFF_METHOD } from "../shared/rpc/diff.js";
import { EDIT_ENTRY_METHOD } from "../shared/rpc/edit-entry.js";
import { GLOSSARY_GET_METHOD } from "../shared/rpc/glossary.js";
import { HISTORY_LIST_METHOD } from "../shared/rpc/history.js";
import { KEY_INTEGRITY_METHOD } from "../shared/rpc/key-integrity.js";
import { KEY_VALUE_METHOD } from "../shared/rpc/key-value.js";
import { LOCK_STATE_METHOD } from "../shared/rpc/lock.js";
import { RETRANSLATE_ENTRY_METHOD } from "../shared/rpc/retranslate-entry.js";
import { REVIEW_QUEUE_METHOD } from "../shared/rpc/review-queue.js";
import { PROJECT_SNAPSHOT_METHOD, type StudioCapabilities } from "../shared/rpc/snapshot.js";
import { TRANSLATE_PENDING_METHOD } from "../shared/rpc/translate-pending.js";
import { USAGE_SUMMARY_METHOD } from "../shared/rpc/usage-summary.js";
import { statusCheckHandler } from "./methods/check.js";
import { statusDiffHandler } from "./methods/diff.js";
import { editEntryHandler } from "./methods/edit-entry.js";
import { glossaryGetHandler } from "./methods/glossary.js";
import { historyListHandler } from "./methods/history.js";
import { keyIntegrityHandler } from "./methods/key-integrity.js";
import { keyValueHandler } from "./methods/key-value.js";
import { lockStateHandler } from "./methods/lock.js";
import { retranslateEntryHandler } from "./methods/retranslate-entry.js";
import { reviewQueueHandler } from "./methods/review-queue.js";
import { snapshotHandler } from "./methods/snapshot.js";
import { translatePendingHandler } from "./methods/translate-pending.js";
import { usageSummaryHandler } from "./methods/usage-summary.js";
import type { StudioServerDeps } from "./types.js";

export type { StudioCapabilities } from "../shared/rpc/snapshot.js";

/**
 * Everything an RPC handler may read: the config resolved once at startup (never re-loaded per
 * request), the project root it resolves relative paths against, and the remaining
 * {@link StudioServerDeps} forwarded unchanged for handlers that need them.
 */
export interface RpcHandlerDeps
  extends Omit<StudioServerDeps, "loader" | "token" | "output" | "assetsRoot"> {
  readonly config: LoadedConfig;
  readonly projectRoot: string;
}

/** The handler function for one RPC method: contract-typed params and deps in, contract-typed result out. */
export type RpcHandler<M extends RpcMethodName> = (
  params: RpcParamsFor<M>,
  deps: RpcHandlerDeps,
) => Promise<RpcResultFor<M>>;

/** A partial handlers record: a method absent here dispatches to `METHOD_UNKNOWN` rather than throwing. */
export type HandlersRegistry = { readonly [M in RpcMethodName]?: RpcHandler<M> };

/**
 * The nine read handlers present in every registry regardless of capability. None of these ever
 * calls a provider or writes to disk; each is gated only on its underlying data existing, never
 * on a capability flag.
 */
const readOnlyHandlers: HandlersRegistry = {
  [PROJECT_SNAPSHOT_METHOD]: snapshotHandler,
  [STATUS_CHECK_METHOD]: statusCheckHandler,
  [STATUS_DIFF_METHOD]: statusDiffHandler,
  [GLOSSARY_GET_METHOD]: glossaryGetHandler,
  [LOCK_STATE_METHOD]: lockStateHandler,
  [HISTORY_LIST_METHOD]: historyListHandler,
  [KEY_INTEGRITY_METHOD]: keyIntegrityHandler,
  [REVIEW_QUEUE_METHOD]: reviewQueueHandler,
  [USAGE_SUMMARY_METHOD]: usageSummaryHandler,
};

/**
 * Builds the capability-gated handlers registry: always the nine read handlers, always
 * `translation.editEntry` and `key.value` (writing a local locale file needs no capability flag,
 * and neither method ever calls a provider), plus `translation.retranslateEntry` and
 * `translation.translatePending` only when `capabilities.spend` is true. Called once by
 * `createStudioServer` before it starts listening; the registry is never rebuilt afterward. A
 * spend-gated method the server was not granted is simply absent from the returned record, and
 * dispatch answers METHOD_UNKNOWN for an absent handler, so absence is the whole gate.
 *
 * The server caches no project data between requests: the config resolved once at startup (see
 * {@link RpcHandlerDeps.config}) is the one value the dashboard holds in memory. Every handler
 * that reads anything else from disk must read it fresh on every call.
 */
export function createRpcHandlers(capabilities: StudioCapabilities): HandlersRegistry {
  return {
    ...readOnlyHandlers,
    [EDIT_ENTRY_METHOD]: editEntryHandler,
    [KEY_VALUE_METHOD]: keyValueHandler,
    ...(capabilities.spend
      ? {
          [RETRANSLATE_ENTRY_METHOD]: retranslateEntryHandler,
          [TRANSLATE_PENDING_METHOD]: translatePendingHandler,
        }
      : {}),
  };
}
