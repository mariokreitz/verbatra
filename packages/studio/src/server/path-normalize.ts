import { sep } from "node:path";

/**
 * Strips a trailing path separator so a root is comparable both as a directory prefix and as an
 * exact match. Callers may pass a root derived from a URL (for example via `fileURLToPath` on a
 * `file://.../` directory URL), which keeps its trailing slash. Shared by the static-asset
 * containment check and the git-log history view's containment check.
 */
export function withoutTrailingSep(path: string): string {
  return path.length > sep.length && path.endsWith(sep) ? path.slice(0, -sep.length) : path;
}
