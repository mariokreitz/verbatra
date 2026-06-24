import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import type { ProviderConfig, ProviderId } from "./provider-config.js";
import type { VerbatraConfig } from "./schema.js";

/**
 * An open union over a provider's known model IDs: the suggested IDs plus any other
 * non-empty string. The `string & {}` arm keeps the union from collapsing to plain
 * `string` (so editors still surface the literals as completions) while accepting a
 * brand-new model ID the tool has never heard of. This is a static authoring hint
 * only; the runtime schema stays `z.string().min(1)` and validates nothing against
 * these literals.
 */
type OpenModel<M extends string> = M | (string & {});

type AuthoringVariant<Id extends ProviderId, M extends string> =
  Extract<ProviderConfig, { id: Id }> extends infer Variant
    ? Variant extends { options: { model: string } }
      ? Omit<Variant, "options"> & {
          options: Omit<Variant["options"], "model"> & { model: OpenModel<M> };
        }
      : never
    : never;

/**
 * The authoring view of one provider variant, keyed by id. LLM providers (anthropic,
 * openai, gemini) narrow `options.model` to that provider's open model union; DeepL has
 * no model field and is carried through unchanged. Keying by id (rather than a flat
 * union) lets {@link AuthoringConfigFor} select exactly one variant for a literal id, so
 * the `options.model` site is a single open union and never a multi-member union.
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
 * When `TId` is a literal (inferred from `provider.id` at the call site), `provider`
 * collapses to one concrete variant, so `options.model` is that provider's open model
 * union alone and not a union across providers. That collapse is what makes editors with
 * weaker discriminated-union narrowing (for example the JetBrains/WebStorm completion
 * engine) offer only the selected provider's models: there is no nested union to narrow.
 * When `TId` defaults to `ProviderId`, `provider` is the full authoring union (today's
 * behavior). Every value assignable here is assignable to {@link VerbatraConfig}, because
 * the open model union is a subtype of `string`; `defineConfig` returns the runtime
 * {@link VerbatraConfig}.
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
