import { describe, expect, it } from "vitest";
import { anthropicConfigSchema } from "./anthropic/config.js";
import type { AnthropicModel } from "./anthropic/models.js";
import { geminiConfigSchema } from "./gemini/config.js";
import type { GeminiModel } from "./gemini/models.js";
import { openAiConfigSchema } from "./openai/config.js";
import type { OpenAiModel } from "./openai/models.js";

type Extends<A, B> = A extends B ? true : false;
type Expect<T extends true> = T;

type LiteralMembers<T> = T extends string ? (string extends T ? never : T) : never;

const knownAnthropic = "claude-opus-4-8";
const knownOpenAi = "gpt-4o";
const knownGemini = "gemini-2.5-flash";
const unknownModel = "some-future-model-2099";

describe("LLM provider authoring model types are sourced from the SDK", () => {
  it("offers each provider's known SDK model literal as an assignable completion", () => {
    type Assertions = [
      Expect<Extends<"claude-opus-4-8", AnthropicModel>>,
      Expect<Extends<"gpt-4o", OpenAiModel>>,
      Expect<Extends<"gemini-2.5-flash", GeminiModel>>,
    ];
    const assertions: Assertions = [true, true, true];
    expect(assertions).toEqual([true, true, true]);
  });

  it("reflects each SDK union shape: open SDKs accept an unknown model string directly", () => {
    type Assertions = [
      Expect<Extends<"some-future-model-2099", AnthropicModel>>,
      Expect<Extends<"some-future-model-2099", GeminiModel>>,
      Expect<Extends<Extends<"some-future-model-2099", OpenAiModel>, false>>,
    ];
    const assertions: Assertions = [true, true, true];
    expect(assertions).toEqual([true, true, true]);
  });

  it("narrows by provider: a foreign literal is not a named member of another provider", () => {
    type Assertions = [
      Expect<Extends<Extends<"gpt-4o", LiteralMembers<AnthropicModel>>, false>>,
      Expect<Extends<Extends<"gemini-2.5-flash", LiteralMembers<AnthropicModel>>, false>>,
      Expect<Extends<Extends<"claude-opus-4-8", LiteralMembers<OpenAiModel>>, false>>,
      Expect<Extends<Extends<"gemini-2.5-flash", LiteralMembers<OpenAiModel>>, false>>,
      Expect<Extends<Extends<"claude-opus-4-8", LiteralMembers<GeminiModel>>, false>>,
      Expect<Extends<Extends<"gpt-4o", LiteralMembers<GeminiModel>>, false>>,
    ];
    const assertions: Assertions = [true, true, true, true, true, true];
    expect(assertions).toEqual([true, true, true, true, true, true]);
  });
});

describe("runtime model validation is unchanged (still z.string().min(1))", () => {
  const cases = {
    anthropic: { schema: anthropicConfigSchema, known: knownAnthropic, extra: { maxTokens: 8 } },
    openai: { schema: openAiConfigSchema, known: knownOpenAi, extra: { maxOutputTokens: 8 } },
    gemini: { schema: geminiConfigSchema, known: knownGemini, extra: { maxOutputTokens: 8 } },
  } as const;

  for (const [provider, { schema, known, extra }] of Object.entries(cases)) {
    it(`${provider} rejects an empty model string`, () => {
      expect(schema.safeParse({ model: "", ...extra }).success).toBe(false);
    });

    it(`${provider} accepts a known model ID`, () => {
      expect(schema.safeParse({ model: known, ...extra }).success).toBe(true);
    });

    it(`${provider} accepts an unknown model string (suggestions do not constrain runtime)`, () => {
      expect(schema.safeParse({ model: unknownModel, ...extra }).success).toBe(true);
    });
  }
});
