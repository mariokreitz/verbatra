#!/usr/bin/env node
// Regression guard for the `ui` command's bundling contract (see packages/cli/tsup.config.ts). Run
// after the build (see the root `check:ui-bundle` script and the CI step). @verbatra/ui is a
// devDependency of @verbatra/cli, never a dependency or peerDependency, so tsup would inline it by
// default; `external: ["@verbatra/ui"]` keeps `await import("@verbatra/ui")` a genuine runtime
// import instead. This is a root script rather than a package Vitest test because it inspects the
// actual built dist/index.js, which `pnpm test` (turbo `test` depends only on `^build`, not on the
// cli package's own build) does not guarantee is fresh.
//
// It enforces two things and fails if either is violated:
//
//   1. The built dist/index.js contains a genuine dynamic import of the literal specifier
//      "@verbatra/ui" (esbuild emits it with single quotes; either quote character is accepted).
//   2. The built dist/index.js does not inline @verbatra/ui's own server source: a sentinel name
//      that only exists inside packages/ui/src/server is absent.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const CLI_DIST_ENTRY = "packages/cli/dist/index.js";

// Matches a dynamic import of the bare specifier, either quote character, exactly like the source.
const DYNAMIC_IMPORT_PATTERN = /import\(\s*['"]@verbatra\/ui['"]\s*\)/;

// Names that only exist inside packages/ui/src/server; their presence in the cli bundle would mean
// tsup inlined @verbatra/ui instead of treating it as an external runtime import.
const UI_SOURCE_SENTINELS = ["assertLoopbackAddress", "FORBIDDEN_BODY"];

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
      `${CLI_DIST_ENTRY} does not contain a dynamic import("@verbatra/ui"); check external in packages/cli/tsup.config.ts.`,
    );
  }
}

/**
 * @param {string} contents
 * @returns {void}
 */
function assertUiSourceNotInlined(contents) {
  const found = UI_SOURCE_SENTINELS.filter((sentinel) => contents.includes(sentinel));
  if (found.length > 0) {
    throw new Error(
      `${CLI_DIST_ENTRY} appears to inline @verbatra/ui source (found: ${found.join(", ")}); it should stay a runtime dynamic import instead.`,
    );
  }
}

function main() {
  const contents = readDist();
  assertDynamicImportPresent(contents);
  assertUiSourceNotInlined(contents);
  console.log(
    "check-cli-ui-bundle: OK, the ui command survives bundling as a runtime dynamic import with no inlined @verbatra/ui source.",
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`check-cli-ui-bundle: ${message}`);
  process.exit(1);
}
