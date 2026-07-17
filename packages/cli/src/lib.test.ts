import { describe, expect, it } from "vitest";
import { defineConfig, type VerbatraConfig } from "./lib.js";

describe("library export", () => {
  it("re-exports the SDK's defineConfig as an identity helper, with the config type", () => {
    const config: VerbatraConfig = {
      sourceLocale: "en",
      targetLocales: ["de"],
      format: "i18next-json",
      files: { pattern: "locales/{locale}.json" },
      provider: { id: "deepl", options: {} },
    };

    expect(typeof defineConfig).toBe("function");
    expect(defineConfig(config as Parameters<typeof defineConfig>[0])).toBe(config);
  });
});
