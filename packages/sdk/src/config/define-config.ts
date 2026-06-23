import type { AuthoringConfig } from "./authoring.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * Identity helper for authoring a code-defined verbatra.config.ts. It returns its
 * argument unchanged; its only purpose is to give the author full type inference and
 * editor autocomplete on the config object.
 *
 * The argument type is {@link AuthoringConfig}, which is structurally a
 * {@link VerbatraConfig} whose `provider.options.model` offers the selected provider's
 * known model IDs as completions while still accepting any other string. The return
 * type is the runtime {@link VerbatraConfig}: the suggestions are a static authoring
 * hint, not a runtime constraint, and `loadConfig` validates `model` exactly as before.
 */
export function defineConfig(config: AuthoringConfig): VerbatraConfig {
  return config;
}
