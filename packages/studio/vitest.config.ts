import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  testInclude: [
    "src/server/**/*.test.ts",
    "src/client/**/*.test.ts",
    "src/shared/**/*.test.ts",
    "src/webmcp/**/*.test.ts",
  ],
  coverageInclude: [
    "src/server/**/*.ts",
    "src/client/**/*.ts",
    "src/shared/**/*.ts",
    "src/webmcp/**/*.ts",
  ],
});
