// Regenerates lib/version.generated.json from the published @verbatra/cli version so the
// landing page has a correct build-time version even when the npm registry is unreachable.
// Runs before dev and build (wired into the scripts in package.json). The output is a
// tracked file; this keeps it in sync on every build, and the live npm value
// (getLatestVersion) layers daily freshness on top of it.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliPackageJsonPath = resolve(here, "../../../packages/cli/package.json");
const outputPath = resolve(here, "../lib/version.generated.json");

const { version } = JSON.parse(readFileSync(cliPackageJsonPath, "utf8"));
if (typeof version !== "string" || version.length === 0) {
  throw new Error(`No usable version in ${cliPackageJsonPath}`);
}

writeFileSync(outputPath, `${JSON.stringify({ version }, null, 2)}\n`);
