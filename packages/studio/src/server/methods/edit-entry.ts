import { editEntry } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's `editEntry`: a locked, human-typed correction gated through the shared integrity
 * check before anything reaches disk, scoped to exactly the requested `(locale, key)` pair. Only
 * reachable when `createRpcHandlers` registered it, which requires `writeToDisk` alone (never
 * `spend`: this seam never calls a provider). Reads the config resolved once at startup, but
 * re-reads the source, target, and lock file fresh from disk on every call, exactly like the
 * read-only views and `translation.retranslateEntry`. Never reads the process environment or any
 * provider-specific variable; unlike `retranslateEntryHandler`, it does not even forward a
 * `createProvider` seam, since `editEntry`'s own deps have no such field.
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
