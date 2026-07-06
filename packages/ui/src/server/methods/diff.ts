import { diff } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `diff`: reports the exact pending change per target locale as three
 * key lists (missing, changed, orphaned), without calling a provider, writing any file, or
 * touching the lock. Reads the config resolved once at startup, but re-reads the source, target,
 * and lock file from disk on every call, never caching them. The result carries every key
 * unfiltered and uncapped (G27); only the browser-facing filter module caps what renders.
 */
export const statusDiffHandler: RpcHandler<"status.diff"> = async (params, deps) =>
  diff({
    config: deps.config.config,
    cwd: deps.projectRoot,
    ...(params.locales !== undefined ? { locales: params.locales } : {}),
  });
