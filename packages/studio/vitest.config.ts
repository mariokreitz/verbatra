import { createVitestConfig } from "@verbatra/config/vitest";

/**
 * The package's Vitest config. `coverageInclude` is an allowlist: only src/server/**,
 * src/client/**, and src/shared/** are measured against the 90% gate. Two directories are
 * deliberately left off: src/app/** (the React SPA components, untested and not gated) and
 * src/dev/ (a local-only dev bootstrap, never built or published). If `coverageInclude` is ever
 * broadened to the repo-default `src/**\/*.ts`, those two must become real coverageExclude
 * entries; this allowlist is the only thing currently keeping them out.
 */
export default createVitestConfig({
  testInclude: ["src/server/**/*.test.ts", "src/client/**/*.test.ts", "src/shared/**/*.test.ts"],
  coverageInclude: ["src/server/**/*.ts", "src/client/**/*.ts", "src/shared/**/*.ts"],
});
