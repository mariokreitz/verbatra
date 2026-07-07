import type { ServerResponse } from "node:http";
import { applyNoStore } from "./security-headers.js";

export const UNAUTHORIZED_BODY = "Unauthorized";
export const FORBIDDEN_BODY = "Forbidden";
export const NOT_FOUND_BODY = "Not Found";
export const METHOD_NOT_ALLOWED_BODY = "Method Not Allowed";
export const PAYLOAD_TOO_LARGE_BODY = "Payload Too Large";
export const UNSUPPORTED_MEDIA_TYPE_BODY = "Unsupported Media Type";
export const NOT_IMPLEMENTED_BODY = "Not Implemented";

/**
 * Writes one of the fixed, generic transport-error bodies. The body is always a constant string
 * supplied by the caller: it never carries a stack trace, a filesystem path, or an environment
 * value, regardless of what caused the rejection.
 */
export function sendConstantResponse(response: ServerResponse, status: number, body: string): void {
  applyNoStore(response);
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(body);
}
