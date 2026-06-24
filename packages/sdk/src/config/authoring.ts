import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import type { ProviderConfig, ProviderId } from "./provider-config.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * The closed set of a provider's known model IDs: exactly the string literals its SDK
 * model type ships, with the SDK's own open `string & {}` arm stripped out. Distributing
 * over the union and dropping any arm the wide `string` extends leaves only the literals,
 * so the authoring field offers and ACCEPTS only the selected provider's known models. A
 * foreign or unknown model (for example a Claude model under `id: "gemini"`) is a type
 * error at authoring time. This is a static authoring constraint only; the runtime schema
 * stays `z.string().min(1)` and still accepts any non-empty string, so a brand-new model
 * the installed SDK does not yet list is flagged in the editor but still runs.
 */
type KnownModels<M extends string> = M extends string ? (string extends M ? never : M) : never;

type AuthoringVariant<Id extends ProviderId, M extends string> =
  Extract<ProviderConfig, { id: Id }> extends infer Variant
    ? Variant extends { options: { model: string } }
      ? Omit<Variant, "options"> & {
          options: Omit<Variant["options"], "model"> & { model: KnownModels<M> };
        }
      : never
    : never;

/**
 * The authoring view of one provider variant, keyed by id. LLM providers (anthropic,
 * openai, gemini) restrict `options.model` to that provider's known model literals; DeepL
 * has no model field and is carried through unchanged. Keying by id (rather than a flat
 * union) lets {@link AuthoringConfigFor} select exactly one variant for a literal id, so
 * the `options.model` site is one provider's literal set and never a multi-provider union.
 */
type AuthoringProviderVariant = {
  anthropic: AuthoringVariant<"anthropic", AnthropicModel>;
  openai: AuthoringVariant<"openai", OpenAiModel>;
  gemini: AuthoringVariant<"gemini", GeminiModel>;
  deepl: Extract<ProviderConfig, { id: "deepl" }>;
};

/**
 * The authoring view of the whole config for a given provider id. It is structurally a
 * {@link VerbatraConfig} whose `provider` is the single authoring variant for `TId`.
 *
 * When `TId` is a single provider literal, `provider` is one concrete variant, so
 * `options.model` is that provider's known model literals alone and not a union across
 * providers. `defineConfig` declares one overload per provider parameterized on this type
 * (`AuthoringConfigFor<"openai">` and so on), so overload resolution picks the variant from
 * the `provider.id` literal. That, together with the closed {@link KnownModels} set, makes a
 * foreign model (for example a Claude model under `id: "gemini"`) a type error and aims to
 * keep editors with weaker discriminated-union narrowing (for example the JetBrains/WebStorm
 * completion engine) offering only the selected provider's models, since each overload's
 * parameter is already a single variant with no nested union to narrow. When `TId` defaults
 * to `ProviderId`, `provider` is the full authoring union. Every value assignable here is
 * assignable to {@link VerbatraConfig}, because a model literal is a subtype of `string`.
 */
export type AuthoringConfigFor<TId extends ProviderId = ProviderId> = Omit<
  VerbatraConfig,
  "provider"
> & {
  provider: AuthoringProviderVariant[TId];
};

/**
 * The authoring view of the whole config across every provider (the `TId = ProviderId`
 * case of {@link AuthoringConfigFor}): identical to {@link VerbatraConfig} except that
 * `provider` offers per-provider model completions.
 */
export type AuthoringConfig = AuthoringConfigFor;
