import { check } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `check`: reports per-locale drift (missing, stale, up-to-date counts
 * and whether each locale, and the aggregate, is in sync) without calling a provider or touching
 * the lock. Reads the config resolved once at startup, but re-reads the source, target, and lock
 * files from disk on every call, never caching them.
 */
export const statusCheckHandler: RpcHandler<"status.check"> = async (params, deps) =>
  check({
    config: deps.config.config,
    cwd: deps.projectRoot,
    ...(params.locales !== undefined ? { locales: params.locales } : {}),
  });
