import { extname } from "node:path";

/** Response Content-Type per served asset file extension. Inbound request Content-Type checking lives in request-content-type.ts. */
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

/**
 * Maps a served asset path to a response Content-Type by its file extension.
 *
 * @param assetPath - The path of the asset being served.
 * @returns The matching Content-Type, or "application/octet-stream" for an unknown extension.
 */
export function contentTypeFor(assetPath: string): string {
  return CONTENT_TYPES[extname(assetPath)] ?? "application/octet-stream";
}
