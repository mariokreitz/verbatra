import { createVitestConfig } from "./vitest.base.mjs";

// The config package owns the preset, so it dogfoods createVitestConfig through a relative import
// (a package cannot resolve its own "@verbatra/config/vitest" subpath under Vite). The preset and the
// AC3 guard live at the package root as .mjs files, not under src/, hence the root-level globs.
export default createVitestConfig({
  testInclude: ["*.test.mjs"],
  coverageInclude: ["vitest.base.mjs"],
});
