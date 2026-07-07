#!/usr/bin/env node
// Regression guard for the `studio` command's bundling contract (see packages/cli/tsup.config.ts).
// Run after the build (see the root `check:studio-bundle` script and the CI step). @verbatra/studio
// is a devDependency of @verbatra/cli, never a dependency or peerDependency, so tsup would inline it
// by default; `external: ["@verbatra/studio"]` keeps `await import("@verbatra/studio")` a genuine
// runtime import instead. This is a root script rather than a package Vitest test because it
// inspects the actual built dist/index.js, which `pnpm test` (turbo `test` depends only on `^build`,
// not on the cli package's own build) does not guarantee is fresh.
//
// It enforces two things and fails if either is violated:
//
//   1. The built dist/index.js contains a genuine dynamic import of the literal specifier
//      "@verbatra/studio" (esbuild emits it with single quotes; either quote character is accepted).
//   2. The built dist/index.js does not inline @verbatra/studio's own server source: a sentinel name
//      that only exists inside packages/studio/src/server is absent.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const CLI_DIST_ENTRY = "packages/cli/dist/index.js";

// Matches a dynamic import of the bare specifier, either quote character, exactly like the source.
const DYNAMIC_IMPORT_PATTERN = /import\(\s*['"]@verbatra\/studio['"]\s*\)/;

// Names that only exist inside packages/studio/src/server; their presence in the cli bundle would
// mean tsup inlined @verbatra/studio instead of treating it as an external runtime import.
const STUDIO_SOURCE_SENTINELS = ["assertLoopbackAddress", "FORBIDDEN_BODY"];

function readDist() {
  const absolutePath = resolve(REPO_ROOT, CLI_DIST_ENTRY);
  if (!existsSync(absolutePath)) {
    throw new Error(`expected built ${CLI_DIST_ENTRY} is missing. Run the build first.`);
  }
  return readFileSync(absolutePath, "utf8");
}

/**
 * @param {string} contents
 * @returns {void}
 */
function assertDynamicImportPresent(contents) {
  if (!DYNAMIC_IMPORT_PATTERN.test(contents)) {
    throw new Error(
      `${CLI_DIST_ENTRY} does not contain a dynamic import("@verbatra/studio"); check external in packages/cli/tsup.config.ts.`,
    );
  }
}

/**
 * @param {string} contents
 * @returns {void}
 */
function assertStudioSourceNotInlined(contents) {
  const found = STUDIO_SOURCE_SENTINELS.filter((sentinel) => contents.includes(sentinel));
  if (found.length > 0) {
    throw new Error(
      `${CLI_DIST_ENTRY} appears to inline @verbatra/studio source (found: ${found.join(", ")}); it should stay a runtime dynamic import instead.`,
    );
  }
}

function main() {
  const contents = readDist();
  assertDynamicImportPresent(contents);
  assertStudioSourceNotInlined(contents);
  console.log(
    "check-cli-studio-bundle: OK, the studio command survives bundling as a runtime dynamic import with no inlined @verbatra/studio source.",
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`check-cli-studio-bundle: ${message}`);
  process.exit(1);
}
