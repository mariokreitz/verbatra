import { keyValue } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

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
