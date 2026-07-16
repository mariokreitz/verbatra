import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import type { ProviderConfig, ProviderId } from "./provider-config.js";
import type { VerbatraConfigInput } from "./schema.js";

/**
 * A provider's known model literals, with the open `string` arm stripped, so the authoring field
 * accepts only that provider's models. Static authoring aid only; the runtime schema stays a
 * non-empty string, so a brand-new model the installed SDK does not yet list is flagged but still
 * runs.
 */
type KnownModels<M extends string> = M extends string ? (string extends M ? never : M) : never;

/** One provider's config variant with `options.model` narrowed to that provider's known literals. */
type AuthoringVariant<Id extends ProviderId, M extends string> =
  Extract<ProviderConfig, { id: Id }> extends infer Variant
    ? Variant extends { options: { model: string } }
      ? Omit<Variant, "options"> & {
          options: Omit<Variant["options"], "model"> & { model: KnownModels<M> };
        }
      : never
    : never;

/**
 * The authoring view of one provider variant, keyed by id. LLM providers with a known SDK model
 * union restrict `options.model` to that provider's literals. DeepL has no model field and
 * openai-compatible's model is whatever the local server exposes (no known-model list to restrict
 * against), so both are carried through unchanged.
 */
type AuthoringProviderVariant = {
  anthropic: AuthoringVariant<"anthropic", AnthropicModel>;
  openai: AuthoringVariant<"openai", OpenAiModel>;
  gemini: AuthoringVariant<"gemini", GeminiModel>;
  deepl: Extract<ProviderConfig, { id: "deepl" }>;
  "openai-compatible": Extract<ProviderConfig, { id: "openai-compatible" }>;
};

/**
 * The authoring view of the whole config for a provider id: a {@link VerbatraConfigInput} whose
 * `provider` is that id's single authoring variant, so `options.model` offers only that provider's
 * models. `glossary` stays the as-authored union (inline record or file path); resolution happens only
 * in `loadConfig`. When `TId` defaults to `ProviderId`, `provider` is the full authoring union. Every
 * value here is assignable to {@link VerbatraConfigInput}, since a model literal is a subtype of
 * `string`.
 */
export type AuthoringConfigFor<TId extends ProviderId = ProviderId> = Omit<
  VerbatraConfigInput,
  "provider"
> & {
  provider: AuthoringProviderVariant[TId];
};

/**
 * The authoring view of the whole config across every provider (the `TId = ProviderId`
 * case of {@link AuthoringConfigFor}): identical to {@link VerbatraConfigInput} except that
 * `provider` offers per-provider model completions.
 */
export type AuthoringConfig = AuthoringConfigFor;
