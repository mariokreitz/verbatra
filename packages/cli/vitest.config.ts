import { createVitestConfig } from "@verbatra/config/vitest";

/**
 * The package Vitest config. The bin shim index.ts is coverage-excluded by the preset; this adds
 * the test helpers (test-support.ts), the readline/TTY seam (prompt.ts, whose decision logic lives
 * in init.ts and is tested there), and the pure re-export barrel (lib.ts, checked by lib.test.ts).
 */
export default createVitestConfig({
  coverageExclude: ["src/test-support.ts", "src/prompt.ts", "src/lib.ts"],
});
