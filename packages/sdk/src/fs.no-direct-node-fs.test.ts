import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL(".", import.meta.url));

const SEAM_OWNER = "fs.ts";
const COSMICONFIG_LOADER_READS_REAL_DISK = "config/load-config.ts";
const TEST_ONLY_HELPERS = "test-support.ts";

const ALLOWED = new Set([SEAM_OWNER, COSMICONFIG_LOADER_READS_REAL_DISK, TEST_ONLY_HELPERS]);

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

  it("no production source outside the seam imports node:fs", () => {
    const offenders = sources.filter((entry) =>
      readFileSync(`${SRC_ROOT}${entry}`, "utf8").includes('"node:fs'),
    );

    expect(offenders).toEqual([]);
  });
});
