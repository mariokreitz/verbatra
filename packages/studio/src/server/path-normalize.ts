import { sep } from "node:path";

/**
 * Strips one trailing path separator so a root path compares cleanly as a directory prefix. A
 * bare separator is returned unchanged, never an empty string. Useful for roots derived via
 * `fileURLToPath` from a directory URL, which keep their trailing slash.
 */
export function withoutTrailingSep(path: string): string {
  return path.length > sep.length && path.endsWith(sep) ? path.slice(0, -sep.length) : path;
}
