import { runStatus } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

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
