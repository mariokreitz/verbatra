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
    // `config` is typed as the runtime VerbatraConfig (model widened to string); defineConfig's
    // authoring overloads restrict model to a provider's known literals, so cast to the overload
    // parameter type to feed the runtime-shaped value through the identity helper.
    expect(defineConfig(config as Parameters<typeof defineConfig>[0])).toBe(config);
  });
});
