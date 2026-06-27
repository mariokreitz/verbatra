import { createVitestConfig } from "@verbatra/config/vitest";

// The bin shim index.ts is a process I/O seam, coverage-excluded by the preset.
export default createVitestConfig({
  coverageExclude: [
    "src/test-support.ts",
    // Thin readline/TTY I/O seam; decision logic lives in init.ts and is tested.
    "src/prompt.ts",
    // Pure re-export barrel; its runtime behavior is checked by lib.test.ts.
    "src/lib.ts",
  ],
});
