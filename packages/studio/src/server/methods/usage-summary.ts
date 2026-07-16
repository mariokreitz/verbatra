import { runStatus } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `runStatus`: passes through `{ available: false }`, or projects the
 * persisted snapshot's run-wide `generatedAt`/`usage`/`budget` fields, unmodified, dropping the
 * per-locale `locales` array `review.queue` already owns. No new computation invented, matching
 * `reviewQueueHandler`'s own precedent. `usage`/`budget` are only ever included when the source
 * field was present: exactOptionalPropertyTypes forbids assigning `undefined` to an optional prop,
 * so each is spread in conditionally rather than defaulted. Always present in the dispatch registry
 * regardless of `capabilities.spend`, since it never calls a provider or writes anything, matching
 * every other unconditional read handler here.
 */
export const usageSummaryHandler: RpcHandler<"usage.summary"> = async (_params, deps) => {
  const result = await runStatus({ cwd: deps.projectRoot });
  if (!result.available) {
    return { available: false };
  }
  return {
    available: true,
    generatedAt: result.generatedAt,
    ...(result.usage !== undefined ? { usage: result.usage } : {}),
    ...(result.budget !== undefined ? { budget: result.budget } : {}),
  };
};
