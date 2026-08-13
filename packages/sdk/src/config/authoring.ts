import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import type { ProviderConfig, ProviderId } from "./provider-config.js";
import type { VerbatraConfigInput } from "./schema.js";

type KnownModels<M extends string> = M extends string ? (string extends M ? never : M) : never;

type AuthoringVariant<Id extends ProviderId, M extends string> =
  Extract<ProviderConfig, { id: Id }> extends infer Variant
    ? Variant extends { options: { model: string } }
      ? Omit<Variant, "options"> & {
          options: Omit<Variant["options"], "model"> & { model: KnownModels<M> };
        }
      : never
    : never;

type AuthoringProviderVariant = {
  anthropic: AuthoringVariant<"anthropic", AnthropicModel>;
  openai: AuthoringVariant<"openai", OpenAiModel>;
  gemini: AuthoringVariant<"gemini", GeminiModel>;
  deepl: Extract<ProviderConfig, { id: "deepl" }>;
  "openai-compatible": Extract<ProviderConfig, { id: "openai-compatible" }>;
};

export type AuthoringConfigFor<TId extends ProviderId = ProviderId> = Omit<
  VerbatraConfigInput,
  "provider"
> & {
  provider: AuthoringProviderVariant[TId];
};

export type AuthoringConfig = AuthoringConfigFor;
