import { lockState } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `lockState`: reports the lock-file's existence, version, and
 * per-locale drift (key count from the recorded baseline, plus missing, stale, and up-to-date
 * counts against the source and target files), without calling a provider, writing any file, or
 * touching the lock. Reads the config resolved once at startup, but re-reads the lock, source,
 * and target files from disk on every call, never caching them.
 */
export const lockStateHandler: RpcHandler<"lock.state"> = async (_params, deps) =>
  lockState({ config: deps.config.config, cwd: deps.projectRoot });
