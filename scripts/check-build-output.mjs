#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PUBLISHED_PACKAGES = new Set(["@verbatra/sdk", "@verbatra/studio"]);

const DECLARATION_SPECIFIER = /(?:from|import)\s*\(?\s*['"](@verbatra\/[a-z-]+)['"]/g;

const STUDIO_DYNAMIC_IMPORT = /import\(\s*['"]@verbatra\/studio['"]\s*\)/;

const STUDIO_STATIC_IMPORT = /(?:^|\s)(?:import|export)[^\n]*?from\s*['"]@verbatra\/studio['"]/m;

function readBuildOutput(relativePath) {
  const absolutePath = resolve(REPO_ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`expected build output ${relativePath} is missing. Run the build first.`);
  }
  return readFileSync(absolutePath, "utf8");
}

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
