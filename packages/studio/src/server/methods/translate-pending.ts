import { translate } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `translation.translatePending` by delegating to the sdk's unfiltered whole-project
 * translate flow, the same call the CLI's `verbatra translate` performs, bringing every
 * configured target locale current against the source. Registered only when the `spend`
 * capability is granted. The method takes no parameters: source drift can affect every target
 * locale at once, so there is no locale to scope to. The optional `fs`, `adapterRegistry`, and
 * `createProvider` seams are forwarded to the sdk, which resolves its own defaults for any that
 * are absent.
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
