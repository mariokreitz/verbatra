import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  coverageExclude: ["src/adapter.ts"],
});
