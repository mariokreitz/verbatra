import { NOT_IMPLEMENTED_BODY } from "./transport-responses.js";

/** The transport-level result of a POST /rpc call: a status and a body ready to write as-is. */
export interface RpcResult {
  readonly statusCode: number;
  readonly body: string;
}

/**
 * Transport-level extension point for POST /rpc. A request reaches this function only after
 * passing the host, origin, authentication, content-type, and body-size gate. The RPC method
 * dispatch, parameter validation, and response envelope are a separate concern that plugs in here
 * once it lands; until then every call answers with a constant not-implemented result.
 */
export async function handleRpcBody(_body: Buffer): Promise<RpcResult> {
  return { statusCode: 501, body: NOT_IMPLEMENTED_BODY };
}
