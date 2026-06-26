import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createVitestConfig } from "./vitest.base.mjs";

const lockedThresholds = { lines: 90, functions: 90, statements: 90, branches: 90 };

describe("createVitestConfig", () => {
  it("applies the default include and exclude globs when called with no options", () => {
    const config = createVitestConfig();
    const { test } = config;

    expect(test?.include).toEqual(["src/**/*.test.ts"]);
    expect(test?.coverage?.include).toEqual(["src/**/*.ts"]);
    expect(test?.coverage?.exclude).toEqual([
      "src/**/*.test.ts",
      "src/index.ts",
      "src/**/types.ts",
    ]);
  });

  it("uses the caller include globs and appends extra excludes to the base excludes", () => {
    const config = createVitestConfig({
      testInclude: ["**/*.test.mjs"],
      coverageInclude: ["*.mjs"],
      coverageExclude: ["**/*.test.mjs", "annotate.mjs"],
    });
    const { coverage, include } = config.test ?? {};

    expect(include).toEqual(["**/*.test.mjs"]);
    expect(coverage?.include).toEqual(["*.mjs"]);
    expect(coverage?.exclude).toEqual([
      "src/**/*.test.ts",
      "src/index.ts",
      "src/**/types.ts",
      "**/*.test.mjs",
      "annotate.mjs",
    ]);
  });

  it("locks the provider, the reporters, and the four 90 percent thresholds", () => {
    const config = createVitestConfig();
    const { coverage } = config.test ?? {};

    expect(coverage?.provider).toBe("v8");
    expect(coverage?.reporter).toEqual(["text", "lcov"]);
    expect(coverage?.thresholds).toEqual(lockedThresholds);
  });

  it("exposes no parameter that can change the locked thresholds", () => {
    // The factory accepts only the three include and exclude globs; any other key is ignored, so a
    // consumer cannot weaken the gate by passing a thresholds override.
    const config = createVitestConfig(
      /** @type {Record<string, unknown>} */ ({ thresholds: { lines: 0 } }),
    );

    expect(config.test?.coverage?.thresholds).toEqual(lockedThresholds);
  });
});

describe("AC3 guard: every consumer vitest.config goes through the preset", () => {
  const packagesDir = join(import.meta.dirname, "..");

  /** @returns {{ pkg: string, path: string, source: string }[]} */
  function collectConsumerConfigs() {
    const entries = readdirSync(packagesDir, { withFileTypes: true });
    const configs = [];

    for (const entry of entries) {
      // The config package is the preset owner and imports the factory by relative path, so it is
      // not a consumer of the published subpath and is excluded from this guard.
      if (!entry.isDirectory() || entry.name === "config") {
        continue;
      }

      for (const file of ["vitest.config.ts", "vitest.config.mjs"]) {
        const path = join(packagesDir, entry.name, file);
        try {
          configs.push({ pkg: entry.name, path, source: readFileSync(path, "utf8") });
        } catch {
          // No config file with this name in this package; keep looking.
        }
      }
    }

    return configs;
  }

  const consumerConfigs = collectConsumerConfigs();

  it("finds a vitest config in every consumer package", () => {
    expect(consumerConfigs.length).toBeGreaterThanOrEqual(7);
  });

  it.each(consumerConfigs)("$pkg imports the @verbatra/config/vitest preset", ({ source }) => {
    expect(source).toContain("@verbatra/config/vitest");
    expect(source).toContain("createVitestConfig");
  });
});
