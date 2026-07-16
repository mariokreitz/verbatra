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

/** A partial handlers record: a method absent here dispatches to `METHOD_UNKNOWN` rather than throwing. */
export type HandlersRegistry = { readonly [M in RpcMethodName]?: RpcHandler<M> };

/**
 * The nine handlers present in every registry regardless of capability: `project.snapshot`,
 * `status.check`, `status.diff`, `glossary.get`, `lock.state`, `history.list`, `key.integrity`,
 * `review.queue`, and `usage.summary`. None of these ever calls a provider or writes to disk.
 * `review.queue` and `usage.summary` are both unconditional (like every other read view here)
 * even though they feed action rows or ceiling awareness elsewhere: each view half is gated only
 * on the persisted run-status data existing, never on a capability flag.
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
 * Builds the capability-gated handlers registry: always the nine read handlers above, always
 * `translation.editEntry` and `key.value` (writing a local locale file needs no capability flag,
 * and neither method ever calls a provider), plus `translation.retranslateEntry` and
 * `translation.translatePending` only when `capabilities.spend` is true. Called exactly once by
 * `createStudioServer`, before `listen()`; the built registry is threaded into `DispatchContext`
 * alongside `rpcDeps` and never rebuilt afterward. A spend-gated method a server was not granted
 * is simply absent from the returned record; `handleRpcBody` already falls back to
 * `METHOD_UNKNOWN` when `handlers[method]` is `undefined`, so no new gate mechanism is introduced
 * here, only a capability-dependent registry.
 *
 * The server caches no project data between requests: `project.snapshot` only reads the config
 * resolved once at startup (see {@link RpcHandlerDeps.config}), which is the one value this whole
 * dashboard intentionally holds in memory. A handler that reads anything else from disk (the
 * status, diff, lock, history, key-integrity, review-queue, usage-summary, retranslate,
 * translate-pending, edit, or key-value views) must read it fresh on every call, never caching it.
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
