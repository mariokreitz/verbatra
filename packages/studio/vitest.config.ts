import { createVitestConfig } from "@verbatra/config/vitest";

export default createVitestConfig({
  testInclude: [
    // This file's own guard, co-located with it at the package root rather than inside a source
    // tree, because it pins the package configuration and not any shipped module.
    "*.test.ts",
    "src/server/**/*.test.ts",
    "src/client/**/*.test.ts",
    "src/shared/**/*.test.ts",
    "src/webmcp/**/*.test.ts",
    "src/app/**/*.test.tsx",
  ],
  coverageInclude: [
    "src/server/**/*.ts",
    "src/client/**/*.ts",
    "src/shared/**/*.ts",
    "src/webmcp/**/*.ts",
    "src/app/**/*.ts",
    "src/app/**/*.tsx",
  ],
  coverageExclude: [
    // The React layer's tests are .test.tsx, which the shared preset's .test.ts exclude misses.
    "src/**/*.test.tsx",
    // Test-only rendering scaffolding, exercised by every app test but never shipped.
    "src/app/test-support.tsx",
    // Bare browser entry point: it mounts the tree and wires module-scope singletons, so
    // importing it under test performs the very side effects it exists to perform.
    "src/app/main.tsx",
    // Type-only: a shared props interface with no runtime output.
    "src/app/panel-props.ts",
    // Ambient module declaration for CSS side-effect imports; no runtime output.
    "src/app/css.d.ts",
  ],
});
