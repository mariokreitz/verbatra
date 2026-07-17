import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  coverageExclude: ["src/test-support.ts", "src/prompt.ts", "src/lib.ts"],
});
