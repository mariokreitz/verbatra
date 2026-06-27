/**
 * Shared Vitest preset for the verbatra monorepo, consumed via {@link createVitestConfig}.
 *
 * Kept as `.mjs` so Node imports it directly on every supported Node, including the 22.14.0 engines
 * floor, without a build step or experimental type stripping. The provider, reporters, and the four
 * thresholds are baked in so a package cannot lower or drop the 90 percent gate.
 *
 * @packageDocumentation
 */

/**
 * Build the shared Vitest config: the locked coverage gate plus the per-package include and exclude
 * globs.
 *
 * @param {object} [options] per-package include and exclude globs; everything else is locked.
 * @param {string[]} [options.testInclude] test file globs (default `["src/**\/*.test.ts"]`).
 * @param {string[]} [options.coverageInclude] measured source globs (default `["src/**\/*.ts"]`).
 * @param {string[]} [options.coverageExclude] extra excludes appended to the baked base excludes (default `[]`).
 * @returns {import("vitest/config").ViteUserConfig} The resolved Vitest config for a package's `vitest.config.ts`.
 * @example
 * ```js
 * import { createVitestConfig } from "@verbatra/config/vitest";
 *
 * // Use the defaults:
 * export default createVitestConfig();
 *
 * // Or add a per-package seam exclude:
 * export default createVitestConfig({ coverageExclude: ["src/client.ts"] });
 * ```
 */
export function createVitestConfig({
  testInclude = ["src/**/*.test.ts"],
  coverageInclude = ["src/**/*.ts"],
  coverageExclude = [],
} = {}) {
  return {
    test: {
      include: testInclude,
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        include: coverageInclude,
        exclude: ["src/**/*.test.ts", "src/index.ts", "src/**/types.ts", ...coverageExclude],
        thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
      },
    },
  };
}
