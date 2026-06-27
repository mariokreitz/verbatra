/**
 * Shared tsup preset for the verbatra monorepo, consumed via {@link createTsupConfig}.
 *
 * Kept as `.mjs` so Node imports it directly at build time on every supported Node, including the
 * 22.14.0 engines floor, without experimental type stripping.
 *
 * @packageDocumentation
 */

/**
 * Build the shared tsup preset with per-package overrides merged on top.
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
