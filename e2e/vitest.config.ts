import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/global-setup.ts"],
    setupFiles: ["./src/report-failures.ts"],
    include: ["tests/**/*.e2e.test.ts", "src/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    maxWorkers: 1,
    reporters: ["default"],
  },
});
