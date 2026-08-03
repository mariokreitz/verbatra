#!/usr/bin/env node
/**
 * Assertions over built artifacts, run after the build. Two guards share this file because they
 * are the same program: read a build output, assert a set of patterns is present or absent, and
 * fail with a message naming the config key that fixes it.
 *
 * Run `node scripts/check-build-output.mjs <target>` where target is `dts` or `studio-bundle`, or
 * with no argument to run every target.
 *
 * TARGET dts: the published declaration files must not reference an unpublished @verbatra/*
 * workspace package. Only @verbatra/sdk and @verbatra/studio are on npm, so anything else is
 * unresolvable in a consumer install. This is an allowlist rather than a denylist on purpose: a
 * future internal package is then forbidden by construction instead of needing to be remembered
 * here. This already shipped once (see "fix(sdk): make published type declarations
 * self-contained"): the provider model types degraded to `never` and every defineConfig call
 * failed with TS2769. The fix is `dts: { resolve: ... }` in packages/sdk/tsup.config.ts, and
 * bundling the JS via noExternal does NOT imply bundling the types.
 *
 * The consumer fixture typechecked alongside it guards a different class, not the same one: in
 * this repo the forbidden specifiers still resolve through pnpm's workspace symlinks, so the
 * fixture cannot see a leak. It catches type-surface degradation originating in source. The grep
 * is the load-bearing half for the leak, and neither publint nor @arethetypeswrong/cli covers it,
 * because both inspect declared entrypoints and package.json rather than what a .d.ts imports.
 *
 * TARGET studio-bundle: @verbatra/studio is a devDependency of @verbatra/cli, never a dependency
 * or peerDependency, so tsup would inline it by default; `external: ["@verbatra/studio"]` in
 * packages/cli/tsup.config.ts keeps `await import("@verbatra/studio")` a real runtime import. If
 * it is inlined, studio's SPA asset root (`new URL("./app/", import.meta.url)`) resolves inside
 * the cli's dist, which has no app directory, and `verbatra studio` serves a blank page.
 *
 * These are root scripts rather than package tests because they inspect built output, which
 * `pnpm test` does not guarantee is fresh: turbo's `test` task depends on `^build`, not on the
 * package's own build.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The only @verbatra/* packages published to npm, so the only ones a declaration may reference. */
const PUBLISHED_PACKAGES = new Set(["@verbatra/sdk", "@verbatra/studio"]);

/**
 * Matches a @verbatra/* specifier in a declaration: a re-export (`from "pkg"`), a bare side-effect
 * import (`import "pkg"`), or a TypeScript inline type import (`import("pkg")`), which
 * rollup-plugin-dts can emit. Anchored on the syntax so a bare mention in JSDoc prose is not a hit.
 */
const DECLARATION_SPECIFIER = /(?:from|import)\s*\(?\s*['"](@verbatra\/[a-z-]+)['"]/g;

/** Matches a dynamic import of the bare @verbatra/studio specifier; esbuild may use either quote. */
const STUDIO_DYNAMIC_IMPORT = /import\(\s*['"]@verbatra\/studio['"]\s*\)/;

/** Matches a STATIC import or re-export of @verbatra/studio, which would defeat the dynamic import. */
const STUDIO_STATIC_IMPORT = /(?:^|\s)(?:import|export)[^\n]*?from\s*['"]@verbatra\/studio['"]/m;

/**
 * Reads a build output, failing loudly when it is absent. An absent file must never read as a
 * silent pass: that is how a guard quietly stops guarding after a build change.
 * @param {string} relativePath - path relative to the repository root
 * @returns {string}
 */
function readBuildOutput(relativePath) {
  const absolutePath = resolve(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`expected build output ${relativePath} is missing. Run the build first.`);
  }
  return readFileSync(absolutePath, "utf8");
}

/**
 * Every forbidden @verbatra/* specifier in one declaration file, scanned per line so a line
 * carrying both an allowed and a forbidden specifier is still caught.
 * @param {string} relativePath - declaration path relative to the repository root
 * @returns {string[]} human-readable `path:line: specifier` hits
 */
function findForbiddenSpecifiers(relativePath) {
  const lines = readBuildOutput(relativePath).split("\n");
  const hits = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const match of (lines[index] ?? "").matchAll(DECLARATION_SPECIFIER)) {
      const specifier = match[1] ?? "";
      if (!PUBLISHED_PACKAGES.has(specifier)) {
        hits.push(`${relativePath}:${index + 1}: ${specifier}`);
      }
    }
  }
  return hits;
}

/** Asserts no published declaration references an unpublished workspace package. */
function checkDts() {
  const declarations = [
    "packages/sdk/dist/index.d.ts",
    "packages/sdk/dist/index.d.cts",
    "packages/cli/dist/lib.d.ts",
    "packages/studio/dist/index.d.ts",
  ];
  const hits = declarations.flatMap(findForbiddenSpecifiers);
  if (hits.length > 0) {
    throw new Error(
      `published declarations reference ${hits.length} unpublished @verbatra/* package(s); ` +
        `check dts.resolve in the owning tsup config:\n  ${hits.join("\n  ")}`,
    );
  }

  execFileSync(
    process.execPath,
    [
      resolve(REPO_ROOT, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "-p",
      resolve(REPO_ROOT, "scripts/dts-fixture/tsconfig.json"),
    ],
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
  return "declarations reference no unpublished package, and the consumer fixture typechecks.";
}

/** Asserts the cli bundle still reaches @verbatra/studio through a runtime dynamic import. */
function checkStudioBundle() {
  const entry = "packages/cli/dist/index.js";
  const contents = readBuildOutput(entry);
  if (!STUDIO_DYNAMIC_IMPORT.test(contents)) {
    throw new Error(
      `${entry} has no dynamic import("@verbatra/studio"); check external in packages/cli/tsup.config.ts.`,
    );
  }
  if (STUDIO_STATIC_IMPORT.test(contents)) {
    throw new Error(
      `${entry} statically imports @verbatra/studio, which would bundle it; keep it a runtime ` +
        "dynamic import and check external in packages/cli/tsup.config.ts.",
    );
  }
  return "the studio command survives bundling as a runtime dynamic import.";
}

const TARGETS = { dts: checkDts, "studio-bundle": checkStudioBundle };

function main() {
  const requested = process.argv[2];
  if (requested !== undefined && !(requested in TARGETS)) {
    throw new Error(
      `unknown target "${requested}"; expected one of ${Object.keys(TARGETS).join(", ")}.`,
    );
  }
  const names = requested === undefined ? Object.keys(TARGETS) : [requested];
  for (const name of names) {
    console.log(`check-build-output(${name}): OK, ${TARGETS[name]()}`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`check-build-output: ${message}`);
  process.exit(1);
}
