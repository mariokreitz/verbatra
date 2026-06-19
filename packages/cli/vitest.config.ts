import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // index.ts is the bin shim (real process streams, real SDK, SIGINT, process.exit), an IO
      // seam, coverage-excluded like the providers' client.ts and the SDK's wiring.ts seams.
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/**/types.ts",
        "src/test-support.ts",
        // Thin readline/TTY I/O seam; decision logic lives in init.ts and is tested.
        "src/prompt.ts",
        // Pure re-export barrel (no logic); its runtime behavior is checked by lib.test.ts.
        "src/lib.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
