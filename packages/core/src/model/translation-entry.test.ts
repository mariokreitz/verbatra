import { describe, expect, it } from "vitest";
import { parseTranslationEntry, translationEntrySchema } from "./translation-entry.js";

const valid = {
  key: "auth.login.submit",
  namespace: "common",
  value: "Sign in",
  placeholders: ["{name}"],
  isPlural: false,
};

describe("translationEntrySchema", () => {
  it("carries the required fields", () => {
    const parsed = parseTranslationEntry(valid);
    expect(parsed.key).toBe("auth.login.submit");
    expect(parsed.namespace).toBe("common");
    expect(parsed.value).toBe("Sign in");
    expect(parsed.placeholders).toEqual(["{name}"]);
    expect(parsed.isPlural).toBe(false);
  });

  it("accepts optional description and meaning", () => {
    const parsed = parseTranslationEntry({ ...valid, description: "ctx", meaning: "verb" });
    expect(parsed.description).toBe("ctx");
    expect(parsed.meaning).toBe("verb");
  });

  it("rejects a missing required field", () => {
    const { key: _key, ...withoutKey } = valid;
    expect(translationEntrySchema.safeParse(withoutKey).success).toBe(false);
  });

  it("rejects an empty key", () => {
    expect(translationEntrySchema.safeParse({ ...valid, key: "" }).success).toBe(false);
  });
});
