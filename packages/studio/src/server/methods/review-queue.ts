import { runStatus } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `review.queue` by delegating to the sdk's read-only `runStatus` and returning its
 * result unchanged: `{ available: false }` when no usable run-status file exists, otherwise the
 * persisted per-locale entries including `needsReview`. Registered unconditionally; it never
 * calls a provider and never writes anything.
 */
export const reviewQueueHandler: RpcHandler<"review.queue"> = async (_params, deps) =>
  runStatus({ cwd: deps.projectRoot });
