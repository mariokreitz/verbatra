/**
 * Shared build, TypeScript, and lint configuration for the verbatra monorepo. Packages consume the
 * tsconfig and Biome JSON files by reference and the tsup preset via {@link createTsupConfig}.
 *
 * This file is plain ESM (`.mjs`) on purpose: tsup externalizes the `@verbatra/config/tsup` import
 * when it loads each package's `tsup.config.ts`, so Node imports this module directly at build time.
 * Keeping it as `.mjs` means it loads natively on every supported Node, including the 22.14.0 engines
 * floor, without relying on experimental type stripping (default only from Node 22.18 / 23.6).
 *
 * @packageDocumentation
 */

/**
 * Build the shared tsup preset (ESM + CJS, type declarations, sourcemaps, clean, treeshake), with
 * per-package overrides merged on top.
 *
 * @param {import("tsup").Options} [overrides] tsup options merged over the preset; keys present here win over the defaults.
 * @returns {import("tsup").Options} The resolved tsup options for a package's `tsup.config.ts`.
 * @example
 * ```js
 * import { createTsupConfig } from "@verbatra/config/tsup";
 *
 * // Use the defaults:
 * export default createTsupConfig();
 *
 * // Or override (e.g. an ESM-only binary):
 * export default createTsupConfig({ format: ["esm"], dts: false });
 * ```
 */
export function createTsupConfig(overrides = {}) {
  return {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    ...overrides,
  };
}
