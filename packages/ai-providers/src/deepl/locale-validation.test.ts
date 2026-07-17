import { describe, expect, it } from "vitest";
import { ProviderError } from "../errors.js";
import { assertValidDeepLSourceLocale, assertValidDeepLTargetLocale } from "./locale-validation.js";

describe("assertValidDeepLSourceLocale", () => {
  it("rejects a regional source code as INVALID_REQUEST, naming the code verbatim", () => {
    try {
      assertValidDeepLSourceLocale("de-DE");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("INVALID_REQUEST");
      expect((error as ProviderError).message).toContain('"de-DE"');
    }
  });

  it("passes a bare source code through without throwing", () => {
    expect(() => assertValidDeepLSourceLocale("en")).not.toThrow();
    expect(() => assertValidDeepLSourceLocale("de")).not.toThrow();
  });
});

describe("assertValidDeepLTargetLocale", () => {
  it("rejects a deprecated bare target code (en) requiring disambiguation", () => {
    try {
      assertValidDeepLTargetLocale("en");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("INVALID_REQUEST");
      expect((error as ProviderError).message).toContain('"en"');
    }
  });

  it("rejects a deprecated bare target code (pt) requiring disambiguation", () => {
    expect(() => assertValidDeepLTargetLocale("pt")).toThrow(ProviderError);
  });

  it("passes a title-case Chinese script subtag through without throwing (deepl-node normalizes it)", () => {
    expect(() => assertValidDeepLTargetLocale("zh-Hans")).not.toThrow();
  });

  it("passes a valid disambiguated target code through without throwing", () => {
    expect(() => assertValidDeepLTargetLocale("en-US")).not.toThrow();
    expect(() => assertValidDeepLTargetLocale("en-GB")).not.toThrow();
    expect(() => assertValidDeepLTargetLocale("pt-BR")).not.toThrow();
  });

  it("passes DeepL's own uppercase Chinese-variant code through unmodified (case-sensitive denylist)", () => {
    expect(() => assertValidDeepLTargetLocale("zh-HANS")).not.toThrow();
  });

  it("passes a plain bare target code through without throwing", () => {
    expect(() => assertValidDeepLTargetLocale("de")).not.toThrow();
  });
});
