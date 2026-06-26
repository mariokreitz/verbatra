import { createVitestConfig } from "@verbatra/config/vitest";

// github-action targets .mjs, not src/. The preset's src-shaped base excludes are inert here.
// annotate.mjs is the I/O entry (argv, file reads, $GITHUB_STEP_SUMMARY append, process.exit),
// a runner seam, coverage-excluded like the CLI bin shim. The pure core report.mjs is covered.
export default createVitestConfig({
  testInclude: ["**/*.test.mjs"],
  coverageInclude: ["*.mjs"],
  coverageExclude: ["**/*.test.mjs", "annotate.mjs"],
});
