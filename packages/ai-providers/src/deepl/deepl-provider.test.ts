import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "../errors.js";
import type { TranslateRequest } from "../provider.js";
import { ProviderRegistry } from "../registry.js";
import {
  deeplResult,
  deeplStubClient,
  entry,
  firstDeeplCall,
  regexExtractor,
} from "../test-support.js";
import { createDeepLProvider } from "./deepl-provider.js";
import type { DeepLTranslateClient, DeepLTranslateResult, ProviderNotice } from "./types.js";

const config = {};

function request(overrides: Partial<TranslateRequest> = {}): TranslateRequest {
  return {
    sourceLocale: "en",
    targetLocale: "de",
    entries: [entry("greeting", "Hello {{name}}", ["{{name}}"])],
    extractPlaceholders: regexExtractor,
    ...overrides,
  };
}

function noticeCodes(result: { notices: readonly ProviderNotice[] }): string[] {
  return result.notices.map((n) => n.code);
}

describe("createDeepLProvider: identity", () => {
  it("declares id deepl, machine-translation kind, and glossary support", () => {
    const { client } = deeplStubClient(deeplResult([]));
    const provider = createDeepLProvider(config, { client });
    expect(provider.id).toBe("deepl");
    expect(provider.kind).toBe("machine-translation");
    expect(provider.supportsGlossary).toBe(true);
  });
});

describe("createDeepLProvider: ordered send and positional zip", () => {
  it("sends values as an ordered array and zips results back to keys by position", async () => {
    const { client, calls } = deeplStubClient(deeplResult(["A", "B"]));
    const result = await createDeepLProvider(config, { client }).translateBatch(
      request({ entries: [entry("a", "A?"), entry("b", "B?")] }),
    );
    expect(firstDeeplCall(calls).texts).toEqual(["A?", "B?"]);
    expect(firstDeeplCall(calls).sourceLang).toBe("en");
    expect(firstDeeplCall(calls).targetLang).toBe("de");
    expect(result.values.get("a")).toBe("A");
    expect(result.values.get("b")).toBe("B");
    expect(result.usage).toBeUndefined();
  });

  it("rejects a length-mismatched result (fewer) as INVALID_RESPONSE, never zips", async () => {
    const { client } = deeplStubClient(deeplResult(["only-one"]));
    await expect(
      createDeepLProvider(config, { client }).translateBatch(
        request({ entries: [entry("a", "A?"), entry("b", "B?")] }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects a length-mismatched result (more) as INVALID_RESPONSE", async () => {
    const { client } = deeplStubClient(deeplResult(["x", "y"]));
    await expect(
      createDeepLProvider(config, { client }).translateBatch(request()),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("createDeepLProvider: tone -> formality", () => {
  it("maps formal -> more, informal -> less, neutral/absent -> omitted (pro key)", async () => {
    const a = deeplStubClient(deeplResult(["x"]));
    await createDeepLProvider(config, { client: a.client }).translateBatch(
      request({ tone: "formal", entries: [entry("k", "v")] }),
    );
    expect(firstDeeplCall(a.calls).options.formality).toBe("more");

    const b = deeplStubClient(deeplResult(["x"]));
    await createDeepLProvider(config, { client: b.client }).translateBatch(
      request({ tone: "informal", entries: [entry("k", "v")] }),
    );
    expect(firstDeeplCall(b.calls).options.formality).toBe("less");

    const c = deeplStubClient(deeplResult(["x"]));
    await createDeepLProvider(config, { client: c.client }).translateBatch(
      request({ tone: "neutral", entries: [entry("k", "v")] }),
    );
    expect(firstDeeplCall(c.calls).options.formality).toBeUndefined();
  });
});

describe("createDeepLProvider: free-key formality degradation", () => {
  it("on a :fx key with a non-default tone, degrades to default formality with an observable notice", async () => {
    const { client, calls } = deeplStubClient(deeplResult(["x"]));
    const result = (await createDeepLProvider(config, {
      client,
      freeAccount: true,
    }).translateBatch(
      request({ tone: "formal", entries: [entry("k", "v")] }),
    )) as DeepLTranslateResult;

    expect(firstDeeplCall(calls).options.formality).toBeUndefined();
    expect(noticeCodes(result)).toContain("FORMALITY_DOWNGRADED");
    const message = result.notices.map((n) => n.message).join(" ");
    expect(message).not.toContain(":fx");
    expect(message).not.toContain("sk-");
  });

  it("does not signal degradation on a :fx key when tone is neutral", async () => {
    const { client } = deeplStubClient(deeplResult(["x"]));
    const result = (await createDeepLProvider(config, {
      client,
      freeAccount: true,
    }).translateBatch(request({ entries: [entry("k", "v")] }))) as DeepLTranslateResult;
    expect(result.notices).toEqual([]);
  });
});

describe("createDeepLProvider: glossary", () => {
  it("passes a configured glossary id natively to translateText", async () => {
    const { client, calls } = deeplStubClient(deeplResult(["x"]));
    await createDeepLProvider({ glossaryId: "gl-123" }, { client }).translateBatch(
      request({ entries: [entry("k", "v")] }),
    );
    expect(firstDeeplCall(calls).options.glossary).toBe("gl-123");
  });

  it("ignores a supplied generic term-map but signals it observably (not an error)", async () => {
    const { client, calls } = deeplStubClient(deeplResult(["x"]));
    const result = (await createDeepLProvider(config, { client }).translateBatch(
      request({ glossary: { Hello: "Hallo" }, entries: [entry("k", "Hello")] }),
    )) as DeepLTranslateResult;
    expect(firstDeeplCall(calls).options.glossary).toBeUndefined();
    expect(noticeCodes(result)).toContain("GLOSSARY_IGNORED");
    expect(result.values.get("k")).toBe("x");
  });
});

describe("createDeepLProvider: per-key integrity (load-bearing for DeepL)", () => {
  it("passes when placeholders are preserved", async () => {
    const { client } = deeplStubClient(deeplResult(["Hallo {{name}}"]));
    const result = await createDeepLProvider(config, { client }).translateBatch(request());
    expect(result.integrity.get("greeting")?.matches).toBe(true);
  });

  it("reports a dropped placeholder per key, not swallowed", async () => {
    const { client } = deeplStubClient(deeplResult(["Hallo"]));
    const result = await createDeepLProvider(config, { client }).translateBatch(request());
    expect(result.integrity.get("greeting")?.matches).toBe(false);
    expect(result.integrity.get("greeting")?.missing).toEqual(["{{name}}"]);
  });

  it("reports an added and a reordered placeholder", async () => {
    const added = deeplStubClient(deeplResult(["Hallo {{name}} {{x}}"]));
    const addedResult = await createDeepLProvider(config, { client: added.client }).translateBatch(
      request(),
    );
    expect(addedResult.integrity.get("greeting")?.extra).toEqual(["{{x}}"]);

    const reordered = deeplStubClient(deeplResult(["{{b}} und {{a}}"]));
    const reorderedResult = await createDeepLProvider(config, {
      client: reordered.client,
    }).translateBatch(request({ entries: [entry("k", "{{a}} {{b}}", ["{{a}}", "{{b}}"])] }));
    expect(reorderedResult.integrity.get("k")?.reordered).toBe(true);
    expect(reorderedResult.integrity.get("k")?.matches).toBe(true);
  });
});

describe("createDeepLProvider: mandatory extractor gate", () => {
  it("rejects a request without an extractor before any client call", async () => {
    const translateText = vi.fn();
    const client: DeepLTranslateClient = { translateText };
    const broken = { ...request(), extractPlaceholders: undefined } as unknown as TranslateRequest;
    await expect(
      createDeepLProvider(config, { client }).translateBatch(broken),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(translateText).not.toHaveBeenCalled();
  });
});

describe("createDeepLProvider: errors and secrets", () => {
  it("never re-throws the raw SDK/axios error and leaks no auth header or key", async () => {
    const secret = "deepl-SECRET-77";
    const translateText = vi.fn(async () => {
      throw new Error(`DeepL-Auth-Key: ${secret} Authorization: Bearer ${secret} config dump`);
    });
    const client: DeepLTranslateClient = { translateText };
    try {
      await createDeepLProvider(config, { client }).translateBatch(request());
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("PROVIDER_ERROR");
      const text = `${(error as ProviderError).message} ${(error as ProviderError).stack ?? ""}`;
      expect(text).not.toContain(secret);
      expect(text).not.toContain("DeepL-Auth-Key");
      expect(text).not.toContain("Authorization");
    }
  });

  it("a failed translation carries no notices (notices ride a successful result only)", async () => {
    const { client } = deeplStubClient(deeplResult(["only-one"]));
    let caught: unknown;
    try {
      await createDeepLProvider(config, { client }).translateBatch(
        // glossary supplied so a notice would be computed, but the failing call discards it
        request({ glossary: { Hello: "Hallo" }, entries: [entry("a", "A?"), entry("b", "B?")] }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProviderError);
    expect((caught as ProviderError).code).toBe("INVALID_RESPONSE");
    expect(caught).not.toHaveProperty("notices");
  });
});

describe("createDeepLProvider: key from env only", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.DEEPL_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.DEEPL_API_KEY;
    } else {
      process.env.DEEPL_API_KEY = saved;
    }
  });

  it("missing DEEPL_API_KEY yields a key-free MISSING_API_KEY before any client call", () => {
    delete process.env.DEEPL_API_KEY;
    try {
      createDeepLProvider(config);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("MISSING_API_KEY");
      expect((error as ProviderError).message).not.toContain("sk-");
    }
  });

  it("builds the default client when the env key is present", () => {
    process.env.DEEPL_API_KEY = "deepl-test-key:fx";
    expect(createDeepLProvider(config).id).toBe("deepl");
  });
});

describe("createDeepLProvider: registry", () => {
  it("resolves under id deepl without disturbing an existing provider", () => {
    const { client } = deeplStubClient(deeplResult([]));
    const deeplProvider = createDeepLProvider(config, { client });
    const registry = new ProviderRegistry();
    registry.register({ ...deeplProvider, id: "openai" }).register(deeplProvider);
    expect(registry.resolve("openai").status).toBe("resolved");
    const resolved = registry.resolve("deepl");
    expect(resolved.status).toBe("resolved");
    if (resolved.status === "resolved") {
      expect(resolved.provider.kind).toBe("machine-translation");
    }
  });
});
