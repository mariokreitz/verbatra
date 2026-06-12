import type { Options } from "tsup";

/**
 * Shared tsup build preset. Packages inherit it and override only
 * what they actually need.
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
