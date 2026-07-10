import { buildProjectSnapshot } from "../projection.js";
import type { RpcHandler } from "../rpc.js";

/** Reads only the config resolved once at startup, so (like glossary.get, but unlike status.check, status.diff, lock.state, and history.list) it never touches disk on a call. */
export const snapshotHandler: RpcHandler<"project.snapshot"> = async (_params, deps) =>
  buildProjectSnapshot(deps.config, deps.projectRoot);
