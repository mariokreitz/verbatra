import { createVitestConfig } from "@verbatra/config/vitest";

// annotate.mjs is the I/O entry (a runner seam) and is coverage-excluded; the pure core report.mjs is covered.
export default createVitestConfig({
  testInclude: ["**/*.test.mjs"],
  coverageInclude: ["*.mjs"],
  coverageExclude: ["**/*.test.mjs", "annotate.mjs"],
});
