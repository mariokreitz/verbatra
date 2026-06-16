// Public library entry for @verbatra/cli: re-exports the config authoring helpers from the SDK so a
// project's verbatra.config.ts can import them from the installed CLI package. Side-effect-free —
// importing this module does NOT execute the CLI (that is the separate bin shim, index.ts).

export type { VerbatraConfig } from "@verbatra/sdk";
export { defineConfig } from "@verbatra/sdk";
