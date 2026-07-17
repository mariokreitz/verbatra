import { keyValue } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `key.value`: forwards to the sdk's read-only `keyValue` for exactly one key/locale
 * pair, with the config resolved once at startup and the server's project root as cwd. The
 * optional `fs` and `adapterRegistry` seams are forwarded when set. This method itself never
 * writes; it supplies the current values an edit dialog pre-populates from.
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
