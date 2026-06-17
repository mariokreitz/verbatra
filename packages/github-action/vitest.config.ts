import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.mjs"],
    coverage: {
      provider: "v8",
      include: ["*.mjs"],
      // annotate.mjs is the I/O entry (argv, file reads, $GITHUB_STEP_SUMMARY append, process.exit),
      // a runner seam, coverage-excluded like the CLI bin shim. The pure core report.mjs is covered.
      exclude: ["**/*.test.mjs", "annotate.mjs"],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
