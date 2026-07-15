import type { z } from "zod";
import { STATUS_CHECK_METHOD, type StatusCheckResult, statusCheckParamsSchema } from "./check.js";
import { STATUS_DIFF_METHOD, type StatusDiffResult, statusDiffParamsSchema } from "./diff.js";
import {
  GLOSSARY_GET_METHOD,
  type GlossaryGetResult,
  glossaryGetParamsSchema,
} from "./glossary.js";
import { HISTORY_LIST_METHOD, type HistoryListResult, historyListParamsSchema } from "./history.js";
import {
  KEY_INTEGRITY_METHOD,
  type KeyIntegrityResult,
  keyIntegrityParamsSchema,
} from "./key-integrity.js";
import { LOCK_STATE_METHOD, type LockStateResult, lockStateParamsSchema } from "./lock.js";
import {
  PROJECT_SNAPSHOT_METHOD,
  type ProjectSnapshotResult,
  projectSnapshotParamsSchema,
} from "./snapshot.js";

/**
 * The single source of truth for the RPC surface: one params schema per method, keyed by its
 * method name. Everything else in this module (the method name list, the method name type, and
 * the request/result type maps) is derived from this record so the agreed methods can never drift
 * out of step with each other.
 */
export const rpcParamsSchemas = {
  [PROJECT_SNAPSHOT_METHOD]: projectSnapshotParamsSchema,
  [STATUS_CHECK_METHOD]: statusCheckParamsSchema,
  [STATUS_DIFF_METHOD]: statusDiffParamsSchema,
  [GLOSSARY_GET_METHOD]: glossaryGetParamsSchema,
  [LOCK_STATE_METHOD]: lockStateParamsSchema,
  [HISTORY_LIST_METHOD]: historyListParamsSchema,
  [KEY_INTEGRITY_METHOD]: keyIntegrityParamsSchema,
} as const;

/** The exact set of agreed RPC methods, derived from {@link rpcParamsSchemas}. */
export type RpcMethodName = keyof typeof rpcParamsSchemas;

/** The method name list, derived from the same record every schema lookup uses. */
export const RPC_METHOD_NAMES = Object.keys(rpcParamsSchemas) as readonly RpcMethodName[];

/** Maps each method name to its result type; each method module owns its own entry. */
export interface RpcResultMap {
  readonly [PROJECT_SNAPSHOT_METHOD]: ProjectSnapshotResult;
  readonly [STATUS_CHECK_METHOD]: StatusCheckResult;
  readonly [STATUS_DIFF_METHOD]: StatusDiffResult;
  readonly [GLOSSARY_GET_METHOD]: GlossaryGetResult;
  readonly [LOCK_STATE_METHOD]: LockStateResult;
  readonly [HISTORY_LIST_METHOD]: HistoryListResult;
  readonly [KEY_INTEGRITY_METHOD]: KeyIntegrityResult;
}

export type RpcParamsFor<M extends RpcMethodName> = z.infer<(typeof rpcParamsSchemas)[M]>;
export type RpcResultFor<M extends RpcMethodName> = RpcResultMap[M];

/** The discriminated union of every valid `{ method, params }` request shape. */
export type RpcRequest = {
  [M in RpcMethodName]: { readonly method: M; readonly params: RpcParamsFor<M> };
}[RpcMethodName];
