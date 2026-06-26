import { describe, expect, it } from "vitest";
import { localeResourceSchema, parseLocaleResource } from "./locale-resource.js";

const entry = {
  key: "greeting",
  namespace: "common",
  value: "Hello",
  placeholders: [],
  isPlural: false,
};

const valid = {
  locale: "de-DE",
  namespace: "common",
  format: "i18next-json",
  entries: new Map([["greeting", entry]]),
};

describe("localeResourceSchema", () => {
  it("carries locale, namespace, format and keyed entries", () => {
    const parsed = parseLocaleResource(valid);
    expect(parsed.locale).toBe("de-DE");
    expect(parsed.namespace).toBe("common");
    expect(parsed.format).toBe("i18next-json");
    expect(parsed.entries.get("greeting")?.value).toBe("Hello");
  });

  it("rejects an empty locale", () => {
    expect(localeResourceSchema.safeParse({ ...valid, locale: "" }).success).toBe(false);
  });

  it("rejects an unknown format", () => {
    expect(localeResourceSchema.safeParse({ ...valid, format: "toml" }).success).toBe(false);
  });
});
