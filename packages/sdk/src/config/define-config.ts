import type { AuthoringConfigFor } from "./authoring.js";
import type { ProviderId } from "./provider-config.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * Identity helper for authoring a code-defined verbatra.config.ts. It returns its
 * argument unchanged; its only purpose is to give the author full type inference and
 * editor autocomplete on the config object.
 *
 * The function is generic over the provider id `TId`. The parameter intersects
 * `{ provider: { id: TId } }` so `provider.id` is a DIRECT inference site: TypeScript
 * infers `TId` straight from the `provider.id` literal at the call site (inferring it
 * through {@link AuthoringConfigFor} alone fails, because `TId` only appears there in an
 * indexed-access position, and the generic would silently fall back to the full-union
 * default). Inferring `TId` collapses the argument type to the single authoring variant
 * for that provider. As a
 * result `provider.options.model` is restricted to that one provider's known model
 * literals, not a union across providers: completions offer only the selected provider's
 * models, and a foreign or unknown model (for example a Claude model under `id: "gemini"`)
 * is a type error. The collapse also removes the nested discriminated-union narrowing that
 * some editors (for example the JetBrains/WebStorm completion engine) do not perform, so
 * the restriction holds editor-side and is not dependent on tsserver-grade union narrowing.
 * With `provider.id` absent, `TId` defaults to {@link ProviderId} and the argument is the
 * full authoring union.
 *
 * The return type is the runtime {@link VerbatraConfig}. The model restriction is a static
 * authoring constraint, not a runtime one: `loadConfig` still validates `model` as
 * `z.string().min(1)`, so a model the installed provider SDK does not yet list is flagged
 * in the editor but still runs.
 */
export function defineConfig<TId extends ProviderId = ProviderId>(
  config: AuthoringConfigFor<TId> & { provider: { id: TId } },
): VerbatraConfig {
  // The argument is an authoring view of a VerbatraConfig (its model literals are a
  // subtype of `string`); the cast restates that to the caller. TypeScript cannot prove
  // the generic `& { provider: { id: TId } }` intersection assignable on its own.
  return config as VerbatraConfig;
}
