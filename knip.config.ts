import type { KnipConfig } from "knip";

// Unused-file, unused-export and unused-dependency detection across the workspace. Every
// suppression below is a documented structural fact about this repository, not a convenience.
//
// Run it with `pnpm knip`. It is deliberately outside `pnpm verify` and outside the CI gate job:
// verify is the merge gate and must stay deterministic, and release.yml publishes on the CI
// workflow's conclusion, so a knip finding must never be able to fail that workflow.
const config: KnipConfig = {
  // An export that its own module already uses is not dead code, only over-exported. The repo bans
  // JSDoc and prose comments on internal code, so knip's per-symbol comment tags are unavailable
  // and this boolean is the only granularity there is.
  ignoreExportsUsedInFile: true,

  // `printf` in the check:no-em-dash script is a shell builtin, not an installable binary.
  ignoreBinaries: ["printf"],

  workspaces: {
    ".": {
      // scripts/ holds the root guards that pnpm verify runs. dts-fixture/consumer.ts is never
      // imported: check:dts compiles it against the built declarations as a standalone consumer.
      entry: ["scripts/*.mjs", "scripts/dts-fixture/consumer.ts"],
      project: ["scripts/**/*.{mjs,ts}"],
    },

    "apps/docs": {
      // Read at runtime by cosmiconfig when the docs site runs `verbatra translate`.
      entry: ["verbatra.config.ts"],
      // The CLI reaches the studio dashboard through a dynamic import, so no source file in the
      // docs app names the package. scripts/check-build-output.mjs guards that indirection.
      ignoreDependencies: ["@verbatra/studio"],
    },

    "packages/sdk": {
      // Runtime dependencies the sdk re-declares because tsup bundles the internal packages that
      // import them, as documented in pnpm-workspace.yaml's "bundled" catalog. They ship to
      // consumers and are load-bearing; knip cannot see through the bundle. Removing any of them
      // would break the published package and collide with scripts/check-dependency-changeset.mjs.
      ignoreDependencies: [
        "@formatjs/icu-messageformat-parser",
        "@xmldom/xmldom",
        "deepl-node",
        "jszip",
        "loglevel",
        "yaml",
      ],
    },

    "packages/studio": {
      // src/shared/rpc is the wire contract between the server, the client, the app and the webmcp
      // surface. Each method module exports its name, its zod params schema, the inferred params
      // type and the result type as one unit, so the inferred half has no importer by design.
      // Entry keeps these files fully analyzed while treating their exports as the contract.
      entry: ["src/shared/rpc/*.ts"],
    },

    // e2e is not a pnpm workspace member: pnpm-workspace.yaml globs packages/* and apps/* only. It
    // has its own manifest and lockfile and installs the packed tarballs. Naming it here is what
    // stops its harness, its two vitest configs and its own devDependencies reading as unused.
    e2e: {
      project: ["src/**/*.ts", "tests/**/*.ts"],
    },
  },
};

export default config;
