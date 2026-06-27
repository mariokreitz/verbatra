/**
 * Shared Vitest configuration for the verbatra monorepo. Each package consumes this preset from its
 * own `vitest.config.ts` via {@link createVitestConfig} instead of copy-pasting the coverage block.
 *
 * This file is plain ESM (`.mjs`) on purpose, mirroring `tsup.base.mjs`: Vitest externalizes the
 * `@verbatra/config/vitest` import when it loads each package's `vitest.config.ts`, so Node imports
 * this module directly. Keeping it as `.mjs` means it loads natively on every supported Node,
 * including the 22.14.0 engines floor, without a build step or experimental type stripping.
 *
 * The factory owns the coverage provider, the reporters, and the four thresholds, and returns the
 * whole Vitest config object. There is no parameter for the provider, the reporters, or the
 * thresholds, and no local coverage object for a consumer to merge over, so a package cannot lower or
 * drop the 90 percent gate. Packages vary only the three include and exclude globs.
 *
 * @packageDocumentation
 */

/**
 * Build the shared Vitest config: the locked coverage gate plus the per-package include and exclude
 * globs. The provider (`v8`), the reporters (`["text", "lcov"]`), and the four 90 percent thresholds
 * are baked in and cannot be overridden.
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
