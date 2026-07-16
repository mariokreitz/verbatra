import { editEntry } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's `editEntry`: a locked, human-typed correction gated through the shared integrity
 * check before anything reaches disk, scoped to exactly the requested `(locale, key)` pair.
 * Always registered by `createRpcHandlers` (local editing needs no capability flag, and this seam
 * never calls a provider, so `spend` is irrelevant). Reads the config resolved once at startup, but
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
