import type { AuthoringConfig, AuthoringConfigFor } from "./authoring.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * Identity helper for authoring a code-defined verbatra.config.ts. It returns its
 * argument unchanged; its only purpose is to give the author full type inference and
 * editor autocomplete on the config object.
 *
 * It is declared as one overload per provider id rather than a single generic. Each
 * overload's parameter is the concrete single-provider authoring config
 * ({@link AuthoringConfigFor}), so `provider.options.model` is already that one provider's
 * known model literals, with no union across providers and no generic for an editor to
 * infer. Overload resolution selects the matching overload from the `provider.id` literal,
 * so the editor offers only the selected provider's models and a foreign or unknown model
 * (for example a Claude model under `id: "gemini"`) is a type error. This is deliberately
 * overload-based: a generic whose type parameter is inferred from a nested `provider.id`
 * collapses correctly in tsserver but not in editors with weaker inference (notably the
 * JetBrains/WebStorm completion engine), which then fall back to the full union and offer
 * every provider's models. Concrete per-provider signatures avoid that inference step.
 *
 * The final overload accepts the full {@link AuthoringConfig} union, so a config whose
 * provider id is not a single literal (for example a value typed as the union) still
 * type-checks.
 *
 * The return type is the runtime {@link VerbatraConfig}. The model restriction is a static
 * authoring constraint, not a runtime one: `loadConfig` still validates `model` as
 * `z.string().min(1)`, so a model the installed provider SDK does not yet list is flagged
 * in the editor but still runs.
 */
export function defineConfig(config: AuthoringConfigFor<"anthropic">): VerbatraConfig;
export function defineConfig(config: AuthoringConfigFor<"openai">): VerbatraConfig;
export function defineConfig(config: AuthoringConfigFor<"gemini">): VerbatraConfig;
export function defineConfig(config: AuthoringConfigFor<"deepl">): VerbatraConfig;
export function defineConfig(config: AuthoringConfig): VerbatraConfig;
export function defineConfig(config: AuthoringConfig): VerbatraConfig {
  return config;
}
