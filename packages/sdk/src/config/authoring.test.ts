import type { AnthropicModel, GeminiModel, OpenAiModel } from "@verbatra/ai-providers";
import { describe, expect, it } from "vitest";
import { baseConfig } from "../test-support.js";
import type { AuthoringConfig } from "./authoring.js";
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
    // type the field is sourced from: the authoring layer adds only the open `string`
    // arm, never new or different literals.
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
    // The open `string & {}` arm makes every string assignable, so narrowing is asserted
    // over the named literal members the SDK unions distinguish.
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

  it("accepts an unknown model string for every LLM provider (open union)", () => {
    type Assertions = [
      Expect<Extends<"some-future-model-2099", AnthropicModelField>>,
      Expect<Extends<"some-future-model-2099", OpenAiModelField>>,
      Expect<Extends<"some-future-model-2099", GeminiModelField>>,
    ];
    const assertions: Assertions = [true, true, true];
    expect(assertions).toEqual([true, true, true]);
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

  it("defineConfig accepts an unknown model string", () => {
    const config = defineConfig({
      sourceLocale: "en",
      targetLocales: ["de"],
      format: "i18next-json",
      files: { pattern: "locales/{locale}.json" },
      provider: { id: "openai", options: { model: "gpt-future-2099", maxOutputTokens: 256 } },
    });
    expect(config.provider.id).toBe("openai");
  });
});

describe("an unknown model loads and reaches provider construction unchanged", () => {
  it("passes loadConfig without error and preserves the model verbatim", async () => {
    const config = await loadConfig({
      configOverride: baseConfig({
        provider: { id: "anthropic", options: { model: "some-future-model-2099", maxTokens: 8 } },
      }),
    });
    expect(config.provider.options).toEqual({ model: "some-future-model-2099", maxTokens: 8 });
  });
});
