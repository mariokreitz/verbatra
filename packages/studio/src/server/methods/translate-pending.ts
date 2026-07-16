import { translate } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's `translate()`, unfiltered: the exact whole-project call `verbatra translate`
 * already performs, bringing every configured target locale current against the source. Only
 * reachable when `createRpcHandlers` registered it, which requires the `spend` capability.
 * Params are always empty (`translation.translatePending` never takes
 * a locale filter, see the shared contract module): there is no locale to scope to, since the
 * action is triggered by source drift, which can affect every target locale at once.
 */
export const translatePendingHandler: RpcHandler<"translation.translatePending"> = async (
  _params,
  deps,
) =>
  translate(
    {
      config: deps.config.config,
      cwd: deps.projectRoot,
    },
    {
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
      ...(deps.createProvider !== undefined ? { createProvider: deps.createProvider } : {}),
    },
  );
