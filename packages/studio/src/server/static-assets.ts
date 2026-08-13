import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { withoutTrailingSep } from "./path-normalize.js";

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

function hasDotSegment(pathWithoutLeadingSlash: string): boolean {
  return pathWithoutLeadingSlash.split("/").some((segment) => segment.startsWith("."));
}

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
