/**
 * Public library entry for @verbatra/cli: re-exports the SDK config authoring helpers so a project's
 * verbatra.config.ts can import them from the installed CLI package. Side-effect-free: importing this
 * module does not execute the CLI (that is the separate bin shim, index.ts).
 *
 * @packageDocumentation
 */

export type { VerbatraConfig } from "@verbatra/sdk";
export { defineConfig } from "@verbatra/sdk";
