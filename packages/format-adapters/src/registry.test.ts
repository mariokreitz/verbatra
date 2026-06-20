import type { SupportedFormat } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { FormatAdapter } from "./adapter.js";
import { AdapterRegistry } from "./registry.js";

function fakeAdapter(format: SupportedFormat, claims: boolean): FormatAdapter {
  return {
    format,
    canHandle: () => claims,
    extractPlaceholders: () => [],
    validateMessage: () => true,
    read: () => Promise.reject(new Error("not used")),
    write: () => Promise.reject(new Error("not used")),
  };
}

describe("AdapterRegistry", () => {
  it("resolves the single adapter that claims a file", () => {
    const registry = new AdapterRegistry().register(fakeAdapter("i18next-json", true));
    const result = registry.resolve("en/common.json");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.adapter.format).toBe("i18next-json");
    }
  });

  it("resolves by explicit format, bypassing detection", () => {
    const registry = new AdapterRegistry().register(fakeAdapter("i18next-json", false));
    const result = registry.resolve("x.unknown", { format: "i18next-json" });
    expect(result.status).toBe("resolved");
  });

  it("reports no-match with the formats it tried", () => {
    const registry = new AdapterRegistry().register(fakeAdapter("i18next-json", false));
    const result = registry.resolve("messages.yaml");
    expect(result).toEqual({
      status: "no-match",
      filePath: "messages.yaml",
      triedFormats: ["i18next-json"],
    });
  });

  it("reports no-match when an explicit format is not registered", () => {
    const registry = new AdapterRegistry().register(fakeAdapter("i18next-json", true));
    const result = registry.resolve("x.json", { format: "vue-i18n-json" });
    expect(result).toEqual({
      status: "no-match",
      filePath: "x.json",
      triedFormats: ["vue-i18n-json"],
    });
  });

  it("reports ambiguity, deterministically, when more than one adapter claims a file", () => {
    const registry = new AdapterRegistry()
      .register(fakeAdapter("i18next-json", true))
      .register(fakeAdapter("vue-i18n-json", true));
    const result = registry.resolve("x.json");
    expect(result).toEqual({
      status: "ambiguous",
      filePath: "x.json",
      candidates: ["i18next-json", "vue-i18n-json"],
    });
  });

  it("accepts a new adapter without changing existing ones (open for extension)", () => {
    const registry = new AdapterRegistry().register(fakeAdapter("i18next-json", false));
    registry.register(fakeAdapter("next-intl-json", true));
    const result = registry.resolve("x.json");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.adapter.format).toBe("next-intl-json");
    }
  });
});
