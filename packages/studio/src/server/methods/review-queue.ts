import { runStatus } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `runStatus`: passes through `{ available: false }` or the persisted
 * `needsReview` entries per locale, unmodified, no new computation invented. Always present in the
 * dispatch registry regardless of `capabilities.spend`/`capabilities.writeToDisk`, matching the
 * other unconditional read handlers: the view half of the needs-review queue needs no write
 * capability, only the action row per flagged key does.
 */
export const reviewQueueHandler: RpcHandler<"review.queue"> = async (_params, deps) =>
  runStatus({ cwd: deps.projectRoot });
