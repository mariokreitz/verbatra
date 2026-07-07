import { extname } from "node:path";

// Outbound direction: what Content-Type this server sets on a served static asset, chosen from
// the asset's file extension. For the inbound direction, checking a request's own Content-Type
// header on POST /rpc, see request-content-type.ts.
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Maps a served asset path to a response Content-Type, falling back to a generic binary type. */
export function contentTypeFor(assetPath: string): string {
  return CONTENT_TYPES[extname(assetPath)] ?? "application/octet-stream";
}
