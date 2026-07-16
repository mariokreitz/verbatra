import { editEntry } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `translation.editEntry`: forwards a human-typed correction for exactly one
 * (locale, key) pair to the sdk's `editEntry`, with the config resolved once at startup and the
 * server's project root as cwd. The optional `fs` and `adapterRegistry` seams are forwarded when
 * set. Never calls a provider and forwards no `createProvider` seam; the sdk's `editEntry` deps
 * have no such field.
 */
export const editEntryHandler: RpcHandler<"translation.editEntry"> = async (params, deps) =>
  editEntry(
    {
      config: deps.config.config,
      cwd: deps.projectRoot,
      locale: params.locale,
      key: params.key,
      value: params.value,
    },
    {
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
    },
  );
