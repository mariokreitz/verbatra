import { buildProjectSnapshot } from "../projection.js";
import type { RpcHandler } from "../rpc.js";

/**
 * Reads only the config resolved once at startup, so (like glossary.get, but unlike status.check,
 * status.diff, lock.state, and history.list) it never touches disk on a call. The projected
 * `capabilities` field reflects the same `spend` boolean `createRpcHandlers` used to build the
 * registry, defaulting to `false` when a caller's deps omit it (matching "off unless explicitly
 * granted"); `writeToDisk` is always `true`, since local editing needs no flag. The projection is
 * a defense-in-depth hint for the client, never the authoritative gate.
 */
export const snapshotHandler: RpcHandler<"project.snapshot"> = async (_params, deps) =>
  buildProjectSnapshot(deps.config, deps.projectRoot, {
    spend: deps.spend ?? false,
    writeToDisk: true,
  });
