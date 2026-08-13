import { runStatus } from "@verbatra/sdk";
import type { RpcHandler } from "../rpc.js";

export const reviewQueueHandler: RpcHandler<"review.queue"> = async (_params, deps) =>
  runStatus({ cwd: deps.projectRoot });
