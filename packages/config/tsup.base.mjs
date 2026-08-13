/**
 * @param {import("tsup").Options} [overrides]
 * @returns {import("./tsup.base.d.mts").TsupConfig}
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
