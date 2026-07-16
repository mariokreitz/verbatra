import { createVitestConfig } from "@verbatra/config/vitest";

/** The package test config: the shared Vitest preset, with the types-only adapter contract excluded from coverage. */
export default createVitestConfig({
  coverageExclude: ["src/adapter.ts"],
});
