import { retranslateEntry } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's `retranslateEntry`: a single-entry provider call gated through the shared
 * integrity check before anything reaches disk, scoped to exactly the requested `(locale, key)`
 * pair. Only reachable when `createRpcHandlers` registered it, which requires the `spend`
 * capability. Reads the config resolved once at startup, but re-reads the source,
 * target, and lock file fresh from disk on every call, exactly like the read-only views. Reaches a
 * provider only through the sdk's own `selectProvider`, the same seam the one-shot translate flow
 * uses; this handler never reads the process environment or any provider-specific variable itself.
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
