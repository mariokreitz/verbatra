import type { AuthoringConfigFor } from "./authoring.js";
import type { ProviderId } from "./provider-config.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * Identity helper for authoring a code-defined verbatra.config.ts. It returns its
 * argument unchanged; its only purpose is to give the author full type inference and
 * editor autocomplete on the config object.
 *
 * The function is generic over the provider id `TId`. TypeScript infers `TId` from the
 * nested `provider.id` literal at the call site, which collapses the argument type
 * ({@link AuthoringConfigFor}) to the single authoring variant for that provider. As a
 * result `provider.options.model` is that one provider's open model union, not a union
 * across providers, so completions offer only the selected provider's known model IDs
 * while still accepting any other string. The collapse removes the nested
 * discriminated-union narrowing that some editors (for example the JetBrains/WebStorm
 * completion engine) do not perform, so per-provider completions are editor-robust and
 * not dependent on tsserver-grade union narrowing. With `provider.id` absent, `TId`
 * defaults to {@link ProviderId} and the argument is the full authoring union.
 *
 * The return type is the runtime {@link VerbatraConfig}: the suggestions are a static
 * authoring hint, not a runtime constraint, and `loadConfig` validates `model` exactly
 * as before.
 */
export function defineConfig<TId extends ProviderId = ProviderId>(
  config: AuthoringConfigFor<TId>,
): VerbatraConfig {
  return config;
}
