import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  testInclude: ["src/server/**/*.test.ts", "src/client/**/*.test.ts", "src/shared/**/*.test.ts"],
  // Allowlist: only src/server/**, src/client/**, and src/shared/** are measured
  // against the 90% gate. Two directories are deliberately left off this list, not
  // silently:
  //
  // - src/app/** (the React SPA shell and its six panel components) has no tests and
  //   is not gated this sprint. It is exercised manually and indirectly through the
  //   server-side RPC and SSE contract tests it consumes; component-level testing
  //   (render, interaction, and snapshot coverage) is real follow-up work, not part
  //   of this change.
  // - src/dev/server.ts is a local-only dev bootstrap: never built, never published,
  //   and not imported by src/index.ts (see its own file header). It runs a real
  //   server as a top-level side effect and carries no decision logic of its own; it
  //   is the same class of process-I/O entry-point seam the shared preset already
  //   excludes for every package's own src/index.ts.
  //
  // If coverageInclude is ever broadened to the repo-default `src/**/*.ts`, these two
  // exclusions must be converted into real coverageExclude entries at that time; the
  // allowlist above is the only thing currently keeping them out.
  coverageInclude: ["src/server/**/*.ts", "src/client/**/*.ts", "src/shared/**/*.ts"],
});
