import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  it("ignores a conflicting thresholds key even when it is spread alongside valid per-package options", () => {
    const optionsWithThresholdsOverride = /** @type {Record<string, unknown>} */ ({
      testInclude: ["custom/**/*.test.ts"],
      thresholds: { lines: 0, functions: 0, statements: 0, branches: 0 },
    });

    const config = createVitestConfig(optionsWithThresholdsOverride);

    expect(config.test?.include).toEqual(["custom/**/*.test.ts"]);
    expect(config.test?.coverage?.thresholds).toEqual(lockedThresholds);
  });
});

describe("every consumer package's vitest config imports the shared preset", () => {
  const packagesDir = join(import.meta.dirname, "..");

  /**
   * Every consumer package's vitest config, one entry per file that exists. The `config` package
   * itself is skipped: it owns the preset and imports it by relative path, so it is not a consumer.
   * Both config file names are probed per package and a package normally carries only one.
   *
   * @returns {{ pkg: string, path: string, source: string }[]}
   */
  function collectConsumerConfigs() {
    const entries = readdirSync(packagesDir, { withFileTypes: true });
    const configs = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "config") {
        continue;
      }

      for (const file of ["vitest.config.ts", "vitest.config.mjs"]) {
        const path = join(packagesDir, entry.name, file);
        if (existsSync(path)) {
          configs.push({ pkg: entry.name, path, source: readFileSync(path, "utf8") });
        }
      }
    }

    return configs;
  }

  const consumerConfigs = collectConsumerConfigs();
  const consumerPackageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "config")
    .map((entry) => entry.name)
    .sort();

  it("finds a vitest config in every workspace package directory", () => {
    const packagesWithConfig = [...new Set(consumerConfigs.map((config) => config.pkg))].sort();

    expect(packagesWithConfig).toEqual(consumerPackageDirs);
  });

  it.each(consumerConfigs)("$pkg imports the @verbatra/config/vitest preset", ({ source }) => {
    expect(source).toContain("@verbatra/config/vitest");
    expect(source).toContain("createVitestConfig");
  });
});
