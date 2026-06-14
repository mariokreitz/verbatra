import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // index.ts is the bin shim (real process streams, real SDK, SIGINT, process.exit) — an IO
      // seam, coverage-excluded like the providers' client.ts and the SDK's wiring.ts seams.
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/**/types.ts", "src/test-support.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
