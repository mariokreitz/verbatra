import { sep } from "node:path";

export function withoutTrailingSep(path: string): string {
  return path.length > sep.length && path.endsWith(sep) ? path.slice(0, -sep.length) : path;
}
