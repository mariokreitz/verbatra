import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROVIDER_ENV, requireAnthropicKey } from "./env.js";
import { ProviderError } from "./errors.js";

describe("PROVIDER_ENV", () => {
  it("maps every provider id to its canonical environment variable name", () => {
    expect(PROVIDER_ENV).toEqual({
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
      deepl: "DEEPL_API_KEY",
    });
  });

  it("covers exactly the four v1 providers", () => {
    expect(Object.keys(PROVIDER_ENV).sort()).toEqual(["anthropic", "deepl", "gemini", "openai"]);
  });
});

describe("requireAnthropicKey", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it("returns the key when the environment variable is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    expect(requireAnthropicKey()).toBe("sk-ant-test-key");
  });

  it("throws a structured, key-free error when the variable is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    try {
      requireAnthropicKey();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("MISSING_API_KEY");
      expect((error as ProviderError).message).not.toContain("sk-");
    }
  });

  it("treats an empty key as missing", () => {
    process.env.ANTHROPIC_API_KEY = "";
    expect(() => requireAnthropicKey()).toThrow(ProviderError);
  });
});
