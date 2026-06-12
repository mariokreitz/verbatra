import { describe, expect, it } from "vitest";
import { createDefaultRegistry } from "./default-registry.js";

describe("createDefaultRegistry", () => {
  it("registers all v1 JSON adapters, so a bare .json is ambiguous", () => {
    const result = createDefaultRegistry().resolve("locales/en/common.json");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates).toEqual([
        "i18next-json",
        "vue-i18n-json",
        "next-intl-json",
        "ngx-translate-json",
      ]);
    }
  });

  it("resolves a specific adapter by explicit format", () => {
    const result = createDefaultRegistry().resolve("en.json", { format: "i18next-json" });
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.adapter.format).toBe("i18next-json");
    }
  });

  it("reports no-match for a non-json file", () => {
    expect(createDefaultRegistry().resolve("messages.yaml").status).toBe("no-match");
  });
});
