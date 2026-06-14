import { AdapterRegistry } from "@verbatra/format-adapters";
import { afterEach, describe, expect, it } from "vitest";
import { buildProvider } from "../config/provider-config.js";
import { SdkError } from "../errors.js";
import { makeStubProvider } from "../test-support.js";
import { selectAdapter } from "./select-adapter.js";
import { selectProvider } from "./select-provider.js";

describe("selectAdapter", () => {
  it("selects the adapter for the configured format", () => {
    expect(selectAdapter("vue-i18n-json").format).toBe("vue-i18n-json");
    expect(selectAdapter("ngx-translate-json").format).toBe("ngx-translate-json");
  });

  it("throws a structured UNKNOWN_FORMAT when no adapter is registered", () => {
    const empty = new AdapterRegistry();
    const error = (() => {
      try {
        selectAdapter("i18next-json", empty);
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("UNKNOWN_FORMAT");
  });
});

describe("selectProvider", () => {
  it("uses the injected createProvider", () => {
    const stub = makeStubProvider({ id: "stub" });
    const provider = selectProvider(
      { id: "anthropic", options: { model: "m", maxTokens: 1 } },
      () => stub.provider,
    );
    expect(provider).toBe(stub.provider);
  });

  it("wraps a non-Error construction failure as a structured error", () => {
    const error = (() => {
      try {
        selectProvider({ id: "deepl", options: {} }, () => {
          throw "raw construction failure";
        });
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect((error as SdkError).code).toBe("PROVIDER_CONSTRUCTION_FAILED");
  });

  it("wraps a construction failure as PROVIDER_CONSTRUCTION_FAILED, secret-free", () => {
    const error = (() => {
      try {
        selectProvider({ id: "anthropic", options: { model: "m", maxTokens: 1 } }, () => {
          throw new Error("missing key");
        });
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("PROVIDER_CONSTRUCTION_FAILED");
  });
});

describe("buildProvider (factory table, offline construction)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("constructs each configured provider from the id->factory table", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.DEEPL_API_KEY = "test-key:fx";

    const anthropic = buildProvider({ id: "anthropic", options: { model: "m", maxTokens: 1 } });
    expect(anthropic.id).toBe("anthropic");
    expect(anthropic.kind).toBe("llm");

    const openai = buildProvider({ id: "openai", options: { model: "m", maxOutputTokens: 1 } });
    expect(openai.id).toBe("openai");

    const gemini = buildProvider({ id: "gemini", options: { model: "m", maxOutputTokens: 1 } });
    expect(gemini.id).toBe("gemini");

    const deepl = buildProvider({ id: "deepl", options: {} });
    expect(deepl.id).toBe("deepl");
    expect(deepl.kind).toBe("machine-translation");
  });
});
