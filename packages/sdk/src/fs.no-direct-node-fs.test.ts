import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL(".", import.meta.url));

const SEAM_OWNER = "fs.ts";
const COSMICONFIG_LOADER_READS_REAL_DISK = "config/load-config.ts";
const MODULE_ALIAS_RESOLVER_READS_REAL_DISK = "config/module-aliases.ts";
const TEST_ONLY_HELPERS = "test-support.ts";

const ALLOWED = new Set([
  SEAM_OWNER,
  COSMICONFIG_LOADER_READS_REAL_DISK,
  MODULE_ALIAS_RESOLVER_READS_REAL_DISK,
  TEST_ONLY_HELPERS,
]);

const MODULE_SPECIFIER = /\b(?:from|import)\b\s*\(?\s*["']([^"']+)["']/g;
const NODE_FS_SPECIFIER = /^(?:node:)?fs(?:\/promises)?$/;

function importsNodeFs(source: string): boolean {
  for (const match of source.matchAll(MODULE_SPECIFIER)) {
    const specifier = match[1];
    if (specifier !== undefined && NODE_FS_SPECIFIER.test(specifier)) {
      return true;
    }
  }
  return false;
}

function productionSources(): string[] {
  return readdirSync(SRC_ROOT, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
    .filter((entry) => !entry.includes(".test."))
    .map((entry) => entry.split("\\").join("/"))
    .filter((entry) => !ALLOWED.has(entry))
    .sort();
}

describe("static proof: SDK sources reach the file system only through the SdkFs seam", () => {
  const sources = productionSources();

  it("finds production sources to scan", () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it("no production source outside the seam imports the file system, prefixed or not", () => {
    const offenders = sources.filter((entry) =>
      importsNodeFs(readFileSync(`${SRC_ROOT}${entry}`, "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});

describe("the guard's detector", () => {
  it.each([
    'import { mkdir } from "node:fs/promises";',
    'import { readFileSync } from "node:fs";',
    'import { mkdir } from "fs/promises";',
    'import { readFileSync } from "fs";',
    "const { mkdir } = await import('node:fs/promises');",
    'export { readFileSync } from "fs";',
  ])("catches %s", (source) => {
    expect(importsNodeFs(source)).toBe(true);
  });

  it.each([
    'import { createDefaultRegistry } from "@verbatra/format-adapters";',
    'import { readFileBounded } from "./fs.js";',
    'import { SdkError } from "./errors.js";',
    'import watcher from "fsevents";',
    'import { copy } from "fs-extra";',
  ])("does not flag %s", (source) => {
    expect(importsNodeFs(source)).toBe(false);
  });
});
