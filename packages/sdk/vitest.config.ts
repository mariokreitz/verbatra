import { createVitestConfig } from "@verbatra/config/vitest";

/**
 * The sdk's Vitest config: the type-only summary module, the chokidar wiring, and the test helpers
 * are excluded from coverage.
 */
export default createVitestConfig({
  coverageExclude: ["src/flow/summary.ts", "src/watch/wiring.ts", "src/test-support.ts"],
});
