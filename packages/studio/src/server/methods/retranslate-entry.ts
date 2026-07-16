import { retranslateEntry } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `translation.retranslateEntry` by delegating to the sdk's `retranslateEntry`: one
 * provider call for exactly the requested locale and key, with the sdk's integrity check applied
 * before anything reaches disk. Registered only when the `spend` capability is granted. It uses
 * the config resolved once at startup but reads the locale and lock files fresh on every call.
 * The handler never reads the process environment or constructs a provider itself; it forwards
 * the optional `fs`, `adapterRegistry`, and `createProvider` seams to the sdk and lets the sdk
 * resolve its own defaults for any that are absent.
 */
export const retranslateEntryHandler: RpcHandler<"translation.retranslateEntry"> = async (
  params,
  deps,
) =>
  retranslateEntry(
    {
      config: deps.config.config,
      cwd: deps.projectRoot,
      locale: params.locale,
      key: params.key,
    },
    {
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
      ...(deps.createProvider !== undefined ? { createProvider: deps.createProvider } : {}),
    },
  );
