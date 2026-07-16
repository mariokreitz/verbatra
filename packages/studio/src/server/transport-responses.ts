import type { ServerResponse } from "node:http";
import { applyNoStore } from "./security-headers.js";

/** The fixed 401 body. */
export const UNAUTHORIZED_BODY = "Unauthorized";
/** The fixed 403 body. */
export const FORBIDDEN_BODY = "Forbidden";
/** The fixed 404 body. */
export const NOT_FOUND_BODY = "Not Found";
/** The fixed 405 body. */
export const METHOD_NOT_ALLOWED_BODY = "Method Not Allowed";
/** The fixed 413 body. */
export const PAYLOAD_TOO_LARGE_BODY = "Payload Too Large";
/** The fixed 415 body. */
export const UNSUPPORTED_MEDIA_TYPE_BODY = "Unsupported Media Type";
/** The fixed 501 body. */
export const NOT_IMPLEMENTED_BODY = "Not Implemented";

/**
 * Writes a transport-error response: no-store, plain text, the given status, and the given body.
 * The body is always one of the constant strings above; it never carries a stack trace, a
 * filesystem path, or an environment value, regardless of what caused the rejection.
 */
export function sendConstantResponse(response: ServerResponse, status: number, body: string): void {
  applyNoStore(response);
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(body);
}
