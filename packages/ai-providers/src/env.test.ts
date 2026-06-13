import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireApiKey } from "./env.js";
import { ProviderError } from "./errors.js";

describe("requireApiKey", () => {
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
    expect(requireApiKey()).toBe("sk-ant-test-key");
  });

  it("throws a structured, key-free error when the variable is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    try {
      requireApiKey();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("MISSING_API_KEY");
      expect((error as ProviderError).message).not.toContain("sk-");
    }
  });

  it("treats an empty key as missing", () => {
    process.env.ANTHROPIC_API_KEY = "";
    expect(() => requireApiKey()).toThrow(ProviderError);
  });
});
