import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  coverageExclude: ["src/flow/summary.ts", "src/watch/wiring.ts", "src/test-support.ts"],
});
