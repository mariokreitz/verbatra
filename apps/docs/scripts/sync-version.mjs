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
