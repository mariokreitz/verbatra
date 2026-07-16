import { diff } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `status.diff`: forwards to the sdk's read-only `diff` with the config resolved once at
 * startup, the server's project root as cwd, and the optional locale filter. Never calls a
 * provider; this handler caches nothing between calls and returns the sdk result as is,
 * unfiltered and uncapped.
 */
export const statusDiffHandler: RpcHandler<"status.diff"> = async (params, deps) =>
  diff({
    config: deps.config.config,
    cwd: deps.projectRoot,
    ...(params.locales !== undefined ? { locales: params.locales } : {}),
  });
