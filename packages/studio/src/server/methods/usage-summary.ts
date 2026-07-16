import { runStatus } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `usage.summary` by delegating to the sdk's read-only `runStatus` and projecting only
 * the run-wide fields: `generatedAt`, `usage`, and `budget`. The per-locale `locales` array stays
 * with `review.queue`. `usage` and `budget` are included only when the persisted snapshot carries
 * them; an absent field is omitted, never defaulted to a fabricated value. Registered
 * unconditionally; it never calls a provider and never writes anything.
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
