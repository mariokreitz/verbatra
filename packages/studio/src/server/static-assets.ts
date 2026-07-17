import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { withoutTrailingSep } from "./path-normalize.js";

/** A static asset read from the assets root: its resolved absolute path and its raw bytes. */
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

/** True when any path segment starts with a dot, for example ".env" or ".git". An empty path never matches. */
function hasDotSegment(pathWithoutLeadingSlash: string): boolean {
  return pathWithoutLeadingSlash.split("/").some((segment) => segment.startsWith("."));
}

function stripQuery(requestPath: string): string {
  const queryIndex = requestPath.indexOf("?");
  return queryIndex === -1 ? requestPath : requestPath.slice(0, queryIndex);
}

/**
 * Resolves a request path to an absolute path inside the assets root, or `undefined` when the
 * request would escape the root or names a dot segment. The query string is stripped, the path
 * is percent-decoded exactly once (falling back to the raw path when decoding fails), and the
 * joined candidate is normalized and checked for containment. The root request maps to
 * index.html.
 */
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

/** Reads the asset a request path resolves to, or `undefined` when it is unreadable, missing, or rejected by {@link resolveAssetPath}. */
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
