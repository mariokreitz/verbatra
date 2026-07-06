import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

/** A static asset read from the assets root, keyed by its resolved absolute path. */
export interface ResolvedAsset {
  readonly path: string;
  readonly body: Buffer;
}

function decodeRequestPath(requestPath: string): string {
  try {
    return decodeURIComponent(requestPath);
  } catch {
    return requestPath;
  }
}

/**
 * Strips a trailing path separator so the root is comparable both as a directory prefix and as an
 * exact match. Callers may pass a root derived from a URL (for example via `fileURLToPath` on a
 * `file://.../` directory URL), which keeps its trailing slash.
 */
function withoutTrailingSep(path: string): string {
  return path.length > sep.length && path.endsWith(sep) ? path.slice(0, -sep.length) : path;
}

/**
 * Resolves a request path to an absolute path inside the assets root, or `undefined` when the
 * request would escape the root. This is a scaffold-level containment check; the full static
 * serving gate (dotfiles, directory listing, single-decode discipline) lands with the server
 * hardening this scaffold exists to carry.
 */
export function resolveAssetPath(assetsRootPath: string, requestPath: string): string | undefined {
  const root = withoutTrailingSep(normalize(assetsRootPath));
  const withoutQuery = requestPath.split("?")[0] ?? "/";
  const decoded = decodeRequestPath(withoutQuery);
  const withoutLeadingSlash = decoded.replace(/^\/+/, "");
  const candidate = normalize(join(root, withoutLeadingSlash || "index.html"));
  const isWithinRoot = candidate === root || candidate.startsWith(root + sep);
  return isWithinRoot ? candidate : undefined;
}

/** Reads the asset a request path resolves to, or `undefined` if it does not exist or escapes the root. */
export async function readAsset(
  assetsRootPath: string,
  requestPath: string,
): Promise<ResolvedAsset | undefined> {
  const resolved = resolveAssetPath(assetsRootPath, requestPath);
  if (resolved === undefined) {
    return undefined;
  }
  try {
    const body = await readFile(resolved);
    return { path: resolved, body };
  } catch {
    return undefined;
  }
}
