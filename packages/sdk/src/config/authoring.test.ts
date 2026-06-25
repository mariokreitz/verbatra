import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import { describe, expect, it } from "vitest";
import { baseConfig } from "../test-support.js";
import type { AuthoringConfig, AuthoringConfigFor } from "./authoring.js";
import { defineConfig } from "./define-config.js";
import { loadConfig } from "./load-config.js";

// Compile-time assertion helpers, verified by `tsc --noEmit` (the typecheck script
// type-checks these *.test.ts files). A failing assertion is a build failure.
type Extends<A, B> = A extends B ? true : false;
type Expect<T extends true> = T;

// Isolate the named literal members of an open model union `M | (string & {})`.
// A widened `string` satisfies `string extends T`; a string literal does not. So
// distributing over the union and dropping any arm the wide `string` extends leaves
// exactly the SDK-shipped literals an editor offers as completions.
type LiteralMembers<T> = T extends string ? (string extends T ? never : T) : never;

// The authoring type for one provider variant's model field.
type ModelOf<Id extends AuthoringConfig["provider"]["id"]> =
  Extract<AuthoringConfig["provider"], { id: Id }> extends { options: { model: infer M } }
    ? M
    : never;

type AnthropicModelField = ModelOf<"anthropic">;
type OpenAiModelField = ModelOf<"openai">;
type GeminiModelField = ModelOf<"gemini">;

// The model field of one provider's concrete authoring config (the parameter type of that
// provider's `defineConfig` overload). This is the property that makes editors with weaker
// discriminated-union narrowing (for example JetBrains/WebStorm) offer only the selected
// provider's models: each overload's argument is one concrete variant, so `options.model`
// is never a cross-provider union and there is no nested union for the editor to narrow.
type CollapsedModelOf<Id extends "anthropic" | "openai" | "gemini"> =
  AuthoringConfigFor<Id>["provider"] extends { options: { model: infer M } } ? M : never;

type CollapsedAnthropic = CollapsedModelOf<"anthropic">;
type CollapsedOpenAi = CollapsedModelOf<"openai">;
type CollapsedGemini = CollapsedModelOf<"gemini">;

describe("provider model authoring suggestions (type-level)", () => {
  it("offers each provider's known SDK model literal as an assignable completion", () => {
    type Assertions = [
      Expect<Extends<"claude-opus-4-8", AnthropicModelField>>,
      Expect<Extends<"gpt-4o", OpenAiModelField>>,
      Expect<Extends<"gemini-2.5-flash", GeminiModelField>>,
    ];
    const assertions: Assertions = [true, true, true];
    expect(assertions).toEqual([true, true, true]);
  });

  it("sources each authoring field from the matching SDK model type", () => {
    // The named literal members of the authoring field are exactly those of the SDK
    // type the field is sourced from: the authoring layer restricts to those literals
    // and adds no new or different ones.
    type Assertions = [
      Expect<Extends<LiteralMembers<AnthropicModelField>, LiteralMembers<AnthropicModel>>>,
      Expect<Extends<LiteralMembers<AnthropicModel>, LiteralMembers<AnthropicModelField>>>,
      Expect<Extends<LiteralMembers<OpenAiModelField>, LiteralMembers<OpenAiModel>>>,
      Expect<Extends<LiteralMembers<OpenAiModel>, LiteralMembers<OpenAiModelField>>>,
      Expect<Extends<LiteralMembers<GeminiModelField>, LiteralMembers<GeminiModel>>>,
      Expect<Extends<LiteralMembers<GeminiModel>, LiteralMembers<GeminiModelField>>>,
    ];
    const assertions: Assertions = [true, true, true, true, true, true];
    expect(assertions).toEqual([true, true, true, true, true, true]);
  });

  it("narrows suggestions by provider id: a foreign literal is not a named member", () => {
    // Narrowing is asserted over the named literal members the SDK unions distinguish.
    type Assertions = [
      Expect<Extends<Extends<"gpt-4o", LiteralMembers<AnthropicModelField>>, false>>,
      Expect<Extends<Extends<"gemini-2.5-flash", LiteralMembers<AnthropicModelField>>, false>>,
      Expect<Extends<Extends<"claude-opus-4-8", LiteralMembers<OpenAiModelField>>, false>>,
      Expect<Extends<Extends<"gemini-2.5-flash", LiteralMembers<OpenAiModelField>>, false>>,
      Expect<Extends<Extends<"claude-opus-4-8", LiteralMembers<GeminiModelField>>, false>>,
      Expect<Extends<Extends<"gpt-4o", LiteralMembers<GeminiModelField>>, false>>,
    ];
    const assertions: Assertions = [true, true, true, true, true, true];
    expect(assertions).toEqual([true, true, true, true, true, true]);
  });

  it("rejects an unknown or foreign model string for every LLM provider (closed union)", () => {
    // The field is the provider's known literals only; an unknown string is not assignable.
    type Assertions = [
      Expect<Extends<Extends<"some-future-model-2099", AnthropicModelField>, false>>,
      Expect<Extends<Extends<"some-future-model-2099", OpenAiModelField>, false>>,
      Expect<Extends<Extends<"some-future-model-2099", GeminiModelField>, false>>,
    ];
    const assertions: Assertions = [true, true, true];
    expect(assertions).toEqual([true, true, true]);
  });

  it("collapses defineConfig to the selected provider's model union for a literal id", () => {
    // The collapsed call-site field carries exactly the matching SDK type's literals (the
    // generic selects one variant) and is closed: no foreign provider's literals and no
    // arbitrary string. This locks in the editor-robust per-provider restriction: there is
    // no cross-provider union to narrow, and a wrong model is a type error.
    type Assertions = [
      Expect<Extends<LiteralMembers<CollapsedOpenAi>, LiteralMembers<OpenAiModel>>>,
      Expect<Extends<LiteralMembers<OpenAiModel>, LiteralMembers<CollapsedOpenAi>>>,
      Expect<Extends<LiteralMembers<CollapsedAnthropic>, LiteralMembers<AnthropicModel>>>,
      Expect<Extends<LiteralMembers<AnthropicModel>, LiteralMembers<CollapsedAnthropic>>>,
      Expect<Extends<LiteralMembers<CollapsedGemini>, LiteralMembers<GeminiModel>>>,
      Expect<Extends<LiteralMembers<GeminiModel>, LiteralMembers<CollapsedGemini>>>,
      // No foreign-provider literal is assignable to a collapsed field.
      Expect<Extends<Extends<"claude-opus-4-8", CollapsedOpenAi>, false>>,
      Expect<Extends<Extends<"gemini-2.5-flash", CollapsedOpenAi>, false>>,
      Expect<Extends<Extends<"gpt-4o", CollapsedAnthropic>, false>>,
      Expect<Extends<Extends<"claude-opus-4-8", CollapsedGemini>, false>>,
      Expect<Extends<Extends<"gpt-4o", CollapsedGemini>, false>>,
      // The union is closed: an arbitrary unknown string is not assignable either.
      Expect<Extends<Extends<"some-future-model-2099", CollapsedOpenAi>, false>>,
      Expect<Extends<Extends<"some-future-model-2099", CollapsedAnthropic>, false>>,
      Expect<Extends<Extends<"some-future-model-2099", CollapsedGemini>, false>>,
    ];
    const assertions: Assertions = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];
    expect(assertions).toEqual(assertions.map(() => true));
  });

  it("defineConfig accepts a known model ID and returns the runtime config unchanged", () => {
    const config = defineConfig({
      sourceLocale: "en",
      targetLocales: ["de"],
      format: "i18next-json",
      files: { pattern: "locales/{locale}.json" },
      provider: { id: "anthropic", options: { model: "claude-opus-4-8", maxTokens: 256 } },
    });
    expect(config.provider.options).toMatchObject({ model: "claude-opus-4-8" });
  });

  it("defineConfig rejects a foreign provider's model at author time (type error)", () => {
    defineConfig({
      sourceLocale: "en",
      targetLocales: ["de"],
      format: "next-intl-json",
      files: { pattern: "messages/{locale}.json" },
      // @ts-expect-error - "claude-opus-4-8" is a Claude model, not a Gemini model
      provider: { id: "gemini", options: { model: "claude-opus-4-8", maxOutputTokens: 256 } },
    });
    expect(true).toBe(true);
  });

  it("defineConfig rejects an unknown model at author time (type error)", () => {
    defineConfig({
      sourceLocale: "en",
      targetLocales: ["de"],
      format: "i18next-json",
      files: { pattern: "locales/{locale}.json" },
      // @ts-expect-error - the closed union no longer accepts an unlisted model ID
      provider: { id: "openai", options: { model: "gpt-future-2099", maxOutputTokens: 256 } },
    });
    expect(true).toBe(true);
  });
});

describe("an unknown model still loads at runtime and reaches provider construction unchanged", () => {
  it("passes loadConfig without error and preserves the model verbatim", async () => {
    const config = await loadConfig({
      configOverride: baseConfig({
        provider: { id: "anthropic", options: { model: "some-future-model-2099", maxTokens: 8 } },
      }),
    });
    expect(config.provider.options).toEqual({ model: "some-future-model-2099", maxTokens: 8 });
  });
});
