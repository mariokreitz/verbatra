import { lockState } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `lock.state` by delegating to the sdk's read-only `lockState`. It never calls a
 * provider and never writes anything. It uses the config resolved once at startup but reads the
 * lock and locale files fresh from disk on every call.
 */
export const lockStateHandler: RpcHandler<"lock.state"> = async (_params, deps) =>
  lockState({ config: deps.config.config, cwd: deps.projectRoot });
