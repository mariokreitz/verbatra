import type { ServerResponse } from "node:http";

/**
 * The exact Content-Security-Policy sent on every response. No unsafe-inline or unsafe-eval:
 * scripts and styles must come from the served origin, nothing may be framed or framed into, and
 * there is no form target or base URI to hijack.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** Applies the fixed security headers that every response carries, regardless of route or status. */
export function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
}

/** Marks a response as never cacheable: used for HTML, the RPC endpoint, and error responses. */
export function applyNoStore(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
}
