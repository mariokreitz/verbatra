import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  testInclude: ["**/*.test.mjs"],
  coverageInclude: ["*.mjs"],
  coverageExclude: ["**/*.test.mjs", "annotate.mjs"],
});
