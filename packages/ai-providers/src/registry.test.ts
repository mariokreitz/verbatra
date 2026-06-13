import { describe, expect, it } from "vitest";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "./provider.js";
import { ProviderRegistry } from "./registry.js";

function fakeProvider(id: string): TranslationProvider {
  return {
    id,
    kind: "llm",
    supportsGlossary: false,
    translateBatch: (_request: TranslateRequest): Promise<TranslateResult> =>
      Promise.resolve({ values: new Map(), integrity: new Map() }),
  };
}

describe("ProviderRegistry", () => {
  it("resolves a registered provider by id", () => {
    const registry = new ProviderRegistry().register(fakeProvider("anthropic"));
    const resolution = registry.resolve("anthropic");
    expect(resolution.status).toBe("resolved");
    if (resolution.status === "resolved") {
      expect(resolution.provider.id).toBe("anthropic");
    }
  });

  it("registers a new provider without changing existing resolution", () => {
    const registry = new ProviderRegistry().register(fakeProvider("anthropic"));
    registry.register(fakeProvider("deepl"));
    expect(registry.resolve("anthropic").status).toBe("resolved");
    expect(registry.resolve("deepl").status).toBe("resolved");
  });

  it("returns a structured outcome for an unknown id, listing known ids", () => {
    const registry = new ProviderRegistry().register(fakeProvider("anthropic"));
    const resolution = registry.resolve("missing");
    expect(resolution.status).toBe("unknown");
    if (resolution.status === "unknown") {
      expect(resolution.id).toBe("missing");
      expect(resolution.known).toEqual(["anthropic"]);
    }
  });
});
