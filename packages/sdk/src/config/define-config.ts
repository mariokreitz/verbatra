import type { AuthoringConfig, AuthoringConfigFor } from "./authoring.js";
import type { VerbatraConfigInput } from "./schema.js";

/**
 * Identity helper for authoring a typed `verbatra.config.ts`. It returns its argument unchanged; its
 * only purpose is full type inference and editor autocomplete on the config object, including
 * completion of the selected provider's known model literals.
 *
 * The model restriction is a static authoring constraint only: `loadConfig` validates `model` as a
 * non-empty string, so a model the installed provider SDK does not yet list is flagged in the editor
 * but still runs. Likewise, `glossary` accepts either an inline record or a file path here; `loadConfig`
 * resolves a path to a record before the translation flow ever sees it.
 *
 * @param config - The verbatra configuration object.
 * @returns The same config, typed as {@link VerbatraConfigInput}.
 */
export function defineConfig(config: AuthoringConfigFor<"anthropic">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfigFor<"openai">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfigFor<"gemini">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfigFor<"deepl">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfig): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfig): VerbatraConfigInput {
  return config;
}
