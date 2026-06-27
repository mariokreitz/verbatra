import { createVitestConfig } from "@verbatra/config/vitest";

// index.ts is the bin shim (real process streams, real SDK, SIGINT, process.exit), an IO
// seam, coverage-excluded by the preset like the providers' client.ts and the SDK's wiring.ts seams.
export default createVitestConfig({
  coverageExclude: [
    "src/test-support.ts",
    // Thin readline/TTY I/O seam; decision logic lives in init.ts and is tested.
    "src/prompt.ts",
    // Pure re-export barrel (no logic); its runtime behavior is checked by lib.test.ts.
    "src/lib.ts",
  ],
});
