import type { VerbatraConfig } from "./schema.js";

/**
 * Identity helper for authoring a code-defined verbatra.config.ts. It returns its
 * argument unchanged; its only purpose is to give the author full type inference and
 * editor autocomplete on the config object.
 */
export function defineConfig(config: VerbatraConfig): VerbatraConfig {
  return config;
}
