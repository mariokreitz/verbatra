import { extname } from "node:path";

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
