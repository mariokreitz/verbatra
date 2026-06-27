import type { AuthoringConfig, AuthoringConfigFor } from "./authoring.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * Identity helper for authoring a typed `verbatra.config.ts`. It returns its argument unchanged; its
 * only purpose is full type inference and editor autocomplete on the config object, including
 * completion of the selected provider's known model literals.
 *
 * The model restriction is a static authoring constraint only: `loadConfig` validates `model` as a
 * non-empty string, so a model the installed provider SDK does not yet list is flagged in the editor
 * but still runs.
 *
 * @param config - The verbatra configuration object.
 * @returns The same config, typed as {@link VerbatraConfig}.
 */
export function defineConfig(config: AuthoringConfigFor<"anthropic">): VerbatraConfig;
export function defineConfig(config: AuthoringConfigFor<"openai">): VerbatraConfig;
export function defineConfig(config: AuthoringConfigFor<"gemini">): VerbatraConfig;
export function defineConfig(config: AuthoringConfigFor<"deepl">): VerbatraConfig;
export function defineConfig(config: AuthoringConfig): VerbatraConfig;
export function defineConfig(config: AuthoringConfig): VerbatraConfig {
  return config;
}
