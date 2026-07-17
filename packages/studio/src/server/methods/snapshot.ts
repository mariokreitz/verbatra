import { buildProjectSnapshot } from "../projection.js";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `project.snapshot` by projecting the config resolved once at startup; it never touches
 * disk on a call. The projected `capabilities` field mirrors the server's own `spend` flag,
 * defaulting to `false` when deps omit it; `writeToDisk` is always `true`, since local editing
 * needs no capability flag. The projection is a display hint for the client, never the
 * authoritative gate.
 */
export const snapshotHandler: RpcHandler<"project.snapshot"> = async (_params, deps) =>
  buildProjectSnapshot(deps.config, deps.projectRoot, {
    spend: deps.spend ?? false,
    writeToDisk: true,
  });
