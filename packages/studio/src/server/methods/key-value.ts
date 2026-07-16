import { keyValue } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `keyValue`: the current source and target string values for exactly
 * one key/locale pair, read live, feeding an edit dialog's pre-population. Only reachable when
 * `createRpcHandlers` registered it, which requires `writeToDisk` alone (this method itself never
 * writes; it is gated because its only legitimate purpose is supplying context for
 * `translation.editEntry`, which does). Reads the config resolved once at startup, but re-reads
 * the source and target files fresh from disk on every call, never caching them.
 */
export const keyValueHandler: RpcHandler<"key.value"> = async (params, deps) =>
  keyValue(
    {
      config: deps.config.config,
      cwd: deps.projectRoot,
      locale: params.locale,
      key: params.key,
    },
    {
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
    },
  );
