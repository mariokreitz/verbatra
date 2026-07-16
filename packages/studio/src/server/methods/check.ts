import { check } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `status.check`: forwards to the sdk's read-only `check` with the config resolved once
 * at startup, the server's project root as cwd, and the optional locale filter. Never calls a
 * provider; this handler caches nothing between calls.
 */
export const statusCheckHandler: RpcHandler<"status.check"> = async (params, deps) =>
  check({
    config: deps.config.config,
    cwd: deps.projectRoot,
    ...(params.locales !== undefined ? { locales: params.locales } : {}),
  });
