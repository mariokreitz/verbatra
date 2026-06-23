import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import type { ProviderConfig } from "./provider-config.js";
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

/**
 * The authoring view of one provider variant: its runtime config with `options.model`
 * narrowed to that provider's open model union. LLM providers (anthropic, openai,
 * gemini) get suggestions; DeepL has no model field and is carried through unchanged.
 */
type AuthoringProviderConfig =
  | AuthoringVariant<"anthropic", AnthropicModel>
  | AuthoringVariant<"openai", OpenAiModel>
  | AuthoringVariant<"gemini", GeminiModel>
  | Extract<ProviderConfig, { id: "deepl" }>;

type AuthoringVariant<Id extends ProviderConfig["id"], M extends string> =
  Extract<ProviderConfig, { id: Id }> extends infer Variant
    ? Variant extends { options: { model: string } }
      ? Omit<Variant, "options"> & {
          options: Omit<Variant["options"], "model"> & { model: OpenModel<M> };
        }
      : never
    : never;

/**
 * The authoring view of the whole config: identical to {@link VerbatraConfig} except
 * that `provider` offers per-provider model completions. Every value assignable to
 * this type is assignable to {@link VerbatraConfig}, because the open model union is a
 * subtype of `string`; `defineConfig` returns the runtime {@link VerbatraConfig}.
 */
export type AuthoringConfig = Omit<VerbatraConfig, "provider"> & {
  provider: AuthoringProviderConfig;
};
