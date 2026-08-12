import { readFileSync } from "node:fs";

/** The fields of this package's own `package.json` the CLI reads at runtime. */
export interface PackageManifest {
  readonly name: string;
  readonly version: string;
}

/**
 * Reads this package's own `package.json`. The "../package.json" offset must resolve from every
 * caller: `src/*.ts` directly under Vitest, and the single bundled `dist/index.js` under tsup (every
 * local import this module reaches is inlined into that one file, so this code always executes one
 * directory level below the package root either way). Preserve the offset if the tsup output depth
 * changes.
 */
export function readPackageManifest(): PackageManifest {
  const manifestUrl = new URL("../package.json", import.meta.url);
  return JSON.parse(readFileSync(manifestUrl, "utf8")) as PackageManifest;
}
