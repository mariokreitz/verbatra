import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { withoutTrailingSep } from "./path-normalize.js";

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

/** True when any path segment starts with a dot, for example ".env" or ".git". The root request ("") never matches. */
function hasDotSegment(pathWithoutLeadingSlash: string): boolean {
  return pathWithoutLeadingSlash.split("/").some((segment) => segment.startsWith("."));
}

/**
 * Resolves a request path to an absolute path inside the assets root, or `undefined` when the
 * request would escape the root or names a dotfile. The path is percent-decoded exactly once,
 * then normalized and checked for containment; there is never a directory listing since only
 * `readFile` is used, never a directory read.
 */
function stripQuery(requestPath: string): string {
  const queryIndex = requestPath.indexOf("?");
  return queryIndex === -1 ? requestPath : requestPath.slice(0, queryIndex);
}

export function resolveAssetPath(assetsRootPath: string, requestPath: string): string | undefined {
  const root = withoutTrailingSep(normalize(assetsRootPath));
  const decoded = decodeRequestPath(stripQuery(requestPath));
  const withoutLeadingSlash = decoded.replace(/^\/+/, "");
  if (hasDotSegment(withoutLeadingSlash)) {
    return undefined;
  }
  const candidate = normalize(join(root, withoutLeadingSlash || "index.html"));
  return candidate.startsWith(root + sep) ? candidate : undefined;
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
