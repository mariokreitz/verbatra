#!/usr/bin/env node
// Regression guard for the published type declarations. Run after the build (see the root `check:dts`
// script and the CI step). It enforces two things and fails if either is violated:
//
//   1. Import grep: the published declaration files must not import or re-export from an unpublished
//      @verbatra/* workspace package (@verbatra/core, @verbatra/ai-providers, @verbatra/format-adapters,
//      @verbatra/exchange, @verbatra/ui). Those packages are never published, so such a specifier is
//      unresolvable in a consumer install and degrades the model types to `any`. A reference to
//      @verbatra/sdk is allowed (it is a real published dependency of @verbatra/cli).
//   2. Consumer typecheck: a fixture that maps @verbatra/sdk to the built dist must typecheck clean,
//      catching the real failure mode (model types collapsing to never/any) that the grep alone misses.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

// Unpublished workspace packages. A published declaration must never emit a specifier from one of these.
const FORBIDDEN_PACKAGES = [
  "@verbatra/core",
  "@verbatra/ai-providers",
  "@verbatra/format-adapters",
  "@verbatra/exchange",
  "@verbatra/ui",
];

// Published declaration files to scan, relative to the repository root.
const DECLARATION_FILES = [
  "packages/sdk/dist/index.d.ts",
  "packages/sdk/dist/index.d.cts",
  "packages/cli/dist/lib.d.ts",
];

const FIXTURE_TSCONFIG = "scripts/dts-fixture/tsconfig.json";
const TSC_BIN = resolve(REPO_ROOT, "node_modules/typescript/bin/tsc");

// Match a forbidden package as a top-level re-export (`from "pkg"`), a bare side-effect import
// (`import "pkg"`), or a TypeScript inline type import (`import("pkg").Foo`), which rollup-plugin-dts
// can emit. Each form carries its own capture group, read in order by scanDeclarationFile.
const PKG_GROUP = `(${FORBIDDEN_PACKAGES.join("|")})`;
const forbiddenSpecifier = new RegExp(
  `from\\s*['"]${PKG_GROUP}['"]|import\\s*['"]${PKG_GROUP}['"]|import\\(\\s*['"]${PKG_GROUP}['"]`,
  "g",
);

/**
 * @typedef {{ file: string; line: number; specifier: string }} Hit
 */

/**
 * @param {string} relativePath
 * @returns {Hit[]}
 */
function scanDeclarationFile(relativePath) {
  const absolutePath = resolve(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`expected built declaration ${relativePath} is missing. Run the build first.`);
  }
  /** @type {Hit[]} */
  const hits = [];
  const lines = readFileSync(absolutePath, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const match of line.matchAll(forbiddenSpecifier)) {
      hits.push({
        file: relativePath,
        line: index + 1,
        specifier: match[1] ?? match[2] ?? match[3] ?? "",
      });
    }
  }
  return hits;
}

/**
 * @returns {Hit[]}
 */
function scanAllDeclarations() {
  /** @type {Hit[]} */
  const hits = [];
  for (const relativePath of DECLARATION_FILES) {
    hits.push(...scanDeclarationFile(relativePath));
  }
  return hits;
}

/**
 * Typecheck the consumer fixture against the built dist. Throws on failure.
 * @returns {void}
 */
function runConsumerTypecheck() {
  try {
    execFileSync(
      process.execPath,
      [TSC_BIN, "--noEmit", "-p", resolve(REPO_ROOT, FIXTURE_TSCONFIG)],
      {
        cwd: REPO_ROOT,
        stdio: "inherit",
      },
    );
  } catch {
    throw new Error(
      "consumer fixture failed to typecheck against the built dist (see the tsc output above).",
    );
  }
}

/**
 * @param {Hit[]} hits
 * @returns {void}
 */
function reportImportHits(hits) {
  console.error(
    `check-published-dts: found ${hits.length} forbidden unpublished @verbatra/* specifier(s) in published declarations:`,
  );
  for (const hit of hits) {
    console.error(`  ${hit.file}:${hit.line}: ${hit.specifier}`);
  }
}

function main() {
  const hits = scanAllDeclarations();
  if (hits.length > 0) {
    reportImportHits(hits);
    process.exit(1);
  }
  console.log(
    "check-published-dts: OK, no unpublished @verbatra/* specifier in published declarations.",
  );

  runConsumerTypecheck();
  console.log("check-published-dts: OK, consumer fixture typechecks against the built dist.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`check-published-dts: ${message}`);
  process.exit(1);
}
