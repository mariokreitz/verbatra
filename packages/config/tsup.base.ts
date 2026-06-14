/**
 * Shared build, TypeScript, and lint configuration for the verbatra monorepo. Packages consume the
 * tsconfig and Biome JSON files by reference and the tsup preset via {@link createTsupConfig}.
 *
 * @packageDocumentation
 */

import type { Options } from "tsup";

/**
 * Build the shared tsup preset (ESM + CJS, type declarations, sourcemaps, clean, treeshake), with
 * per-package overrides merged on top.
 *
 * @param overrides - tsup options merged over the preset; keys present here win over the defaults.
 * @returns The resolved tsup options for a package's `tsup.config.ts`.
 * @example
 * ```ts
 * import { createTsupConfig } from "@verbatra/config/tsup";
 *
 * // Use the defaults:
 * export default createTsupConfig();
 *
 * // Or override (e.g. an ESM-only binary):
 * export default createTsupConfig({ format: ["esm"], dts: false });
 * ```
 */
export function createTsupConfig(overrides: Options = {}): Options {
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
