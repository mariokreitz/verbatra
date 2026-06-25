import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TranslationProvider } from "@verbatra/ai-providers";
import { createDefaultRegistry } from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import {
  baseConfig,
  makeFakeFs,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
} from "../test-support.js";
import { translate } from "./translate-project.js";

async function project(
  source: Record<string, unknown>,
  targets: Record<string, Record<string, unknown> | undefined>,
): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  for (const [locale, obj] of Object.entries(targets)) {
    if (obj !== undefined) {
      await writeJsonFile(join(dir, "locales", `${locale}.json`), obj);
    }
  }
  return dir;
}

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", `${locale}.json`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de"], ...overrides });

describe("translate: one-shot flow", () => {
  it("translates only missing keys, preserves existing ones, writes the lock-file", async () => {
    const dir = await project(
      { greeting: "Hello", farewell: "Bye" },
      { de: { greeting: "Hallo" } },
    );
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.succeeded).toEqual(["de"]);
    expect(summary.locales[0]?.translated).toEqual(["farewell"]);
    expect(summary.locales[0]?.unchanged).toEqual(["greeting"]);
    // only the missing key was sent to the provider
    expect(stub.calls[0]?.request.entries.map((e) => e.key)).toEqual(["farewell"]);

    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.greeting).toBe("Hallo"); // untouched
    expect(de.farewell).toBe("[de] Bye"); // translated

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(Object.keys(lock.locales.de ?? {}).sort()).toEqual(["farewell", "greeting"]);
  });

  it("injects the adapter-matching extractor into the provider request", async () => {
    const registry = createDefaultRegistry();
    const expected = registry.resolve("", { format: "vue-i18n-json" });
    const i18next = registry.resolve("", { format: "i18next-json" });
    const dir = await project({ greeting: "Hi {name}" }, { de: undefined });
    const stub = makeStubProvider();

    await translate(
      { config: cfg({ format: "vue-i18n-json" }), cwd: dir },
      { createProvider: () => stub.provider, adapterRegistry: registry },
    );

    const injected = stub.calls[0]?.request.extractPlaceholders;
    if (expected.status !== "resolved" || i18next.status !== "resolved") {
      throw new Error("registry did not resolve");
    }
    expect(injected).toBe(expected.adapter.extractPlaceholders);
    expect(injected).not.toBe(i18next.adapter.extractPlaceholders);
  });

  it("creates an absent target file (the add-a-new-locale path)", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const stub = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });
    expect(await exists(targetPath(dir, "de"))).toBe(true);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.a).toBe("[de] A");
  });

  it("an absent source file is a whole-run SOURCE_UNREADABLE error", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    const stub = makeStubProvider();
    await expect(
      translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider }),
    ).rejects.toMatchObject({ code: "SOURCE_UNREADABLE" });
  });
});

describe("translate: integrity withholding", () => {
  it("withholds a missing key that fails integrity, does not lock it, retries next run", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const failing = makeStubProvider({ failIntegrity: new Set(["a"]) });

    const run1 = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => failing.provider },
    );
    expect(run1.locales[0]?.integrityMismatches).toEqual(["a"]);
    expect(run1.locales[0]?.translated).toEqual([]);
    const de1 = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de1.a).toBeUndefined(); // not written
    const lock1 = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(lock1.locales.de?.a).toBeUndefined(); // not locked

    const passing = makeStubProvider();
    const run2 = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => passing.provider },
    );
    expect(run2.locales[0]?.translated).toEqual(["a"]); // retried
    const de2 = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de2.a).toBe("[de] A");
  });

  it("changed-but-failed-integrity keeps prior value + prior hash + retries; a sibling refreshes", async () => {
    const dir = await project({ a: "A0", c: "C0" }, { de: undefined });
    const pass0 = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => pass0.provider });
    const lock0 = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    const priorA = lock0.locales.de?.a;
    const priorC = lock0.locales.de?.c;

    // change both source values; a will fail integrity, c will succeed
    await writeJsonFile(join(dir, "locales", "en.json"), { a: "A1", c: "C1" });
    const failingA = makeStubProvider({ failIntegrity: new Set(["a"]) });
    const run1 = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => failingA.provider },
    );

    expect(run1.locales[0]?.integrityMismatches).toEqual(["a"]);
    const de1 = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de1.a).toBe("[de] A0"); // prior translation retained, NOT the mangled new value
    expect(de1.c).toBe("[de] C1"); // sibling updated
    const lock1 = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(lock1.locales.de?.a).toBe(priorA); // prior hash retained (frozen)
    expect(lock1.locales.de?.c).not.toBe(priorC); // sibling refreshed

    // a is still source != lock-hash -> retried and now succeeds
    const passing = makeStubProvider();
    const run2 = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => passing.provider },
    );
    expect(run2.locales[0]?.translated).toEqual(["a"]);
    const de2 = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de2.a).toBe("[de] A1");
  });
});

describe("translate: change detection and first run", () => {
  it("skips an unchanged source on re-run and re-translates after a source change", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );

    const rerun = makeStubProvider();
    const run2 = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => rerun.provider },
    );
    expect(rerun.calls).toHaveLength(0); // unchanged -> provider not called
    expect(run2.locales[0]?.translated).toEqual([]);

    await writeJsonFile(join(dir, "locales", "en.json"), { a: "A-changed" });
    const changed = makeStubProvider();
    const run3 = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => changed.provider },
    );
    expect(run3.locales[0]?.translated).toEqual(["a"]); // changed source re-translated
  });

  it("first run adopts the current source as baseline without retroactively re-translating", async () => {
    const dir = await project({ a: "A" }, { de: { a: "da-existing" } });
    const stub = makeStubProvider();
    const run = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(0); // already-present key not re-translated
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.a).toBe("da-existing"); // untouched
    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(lock.locales.de?.a).toBeDefined(); // adopted as baseline
    expect(run.locales[0]?.unchanged).toEqual(["a"]);
  });
});

describe("translate: per-locale isolation", () => {
  it("isolates a locale whose only sub-batch throws as succeeded-with-withheld; others are written and locked", async () => {
    const dir = await project({ a: "A" }, { de: undefined, fr: undefined, es: undefined });
    const stub = makeStubProvider({ throwForLocales: new Set(["fr"]) });

    const summary = await translate(
      { config: cfg({ targetLocales: ["de", "fr", "es"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    // A chunk-level provider throw no longer sinks the locale: it stays succeeded, its keys are
    // withheld for retry, and a notice surfaces. The run continues across all locales.
    expect([...summary.succeeded].sort()).toEqual(["de", "es", "fr"]);
    expect(summary.failed).toEqual([]);
    const fr = summary.locales.find((s) => s.locale === "fr");
    expect(fr?.status).toBe("succeeded");
    expect(fr?.translated).toEqual([]);
    expect(fr?.integrityMismatches).toEqual(["a"]);
    expect(fr?.notices.map((n) => n.code)).toContain("SUB_BATCH_FAILED");

    expect(await exists(targetPath(dir, "de"))).toBe(true);
    expect(await exists(targetPath(dir, "es"))).toBe(true);

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    // fr's withheld key is not locked, so it retries next run; de and es are locked.
    expect(lock.locales.fr?.a).toBeUndefined();
    expect(lock.locales.de?.a).toBeDefined();
    expect(lock.locales.es?.a).toBeDefined();
  });

  it("isolates a non-provider per-locale failure (lock write) as a failed locale; the run continues", async () => {
    const dir = await project({ a: "A" }, { de: undefined, fr: undefined });
    const stub = makeStubProvider();
    // The lock write (an SdkFs.writeFile, not an adapter call) happens per-locale inside the run's
    // try; throwing it only for the locale being recorded leaves a genuine failed summary.
    const fs = makeFakeFs({
      fileExists: (path: string) =>
        access(path)
          .then(() => true)
          .catch(() => false),
      writeFile: async (path: string, data: string) => {
        if (path.endsWith("verbatra.lock.json") && data.includes('"fr"')) {
          throw Object.assign(new Error("lock write failed"), { code: "LOCK_FILE_WRITE" });
        }
      },
    });

    const summary = await translate(
      { config: cfg({ targetLocales: ["de", "fr"] }), cwd: dir },
      { createProvider: () => stub.provider, fs },
    );

    expect(summary.failed).toEqual(["fr"]);
    expect(summary.locales.find((s) => s.locale === "fr")?.error?.code).toBe("LOCK_FILE_WRITE");
  });
});

describe("translate: error shapes and orphaned keys", () => {
  it("a malformed source file is a whole-run SOURCE_INVALID error", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeFile(join(dir, "locales", "en.json"), "{ not valid json", "utf8");
    const stub = makeStubProvider();
    await expect(
      translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider }),
    ).rejects.toMatchObject({ code: "SOURCE_INVALID" });
  });

  it("withholds the keys of a throwing sub-batch and surfaces a notice instead of failing the locale", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const coded = Object.assign(new Error("provider blew up"), { code: "PROVIDER_ERROR" });
    const provider: TranslationProvider = {
      id: "x",
      kind: "llm",
      supportsGlossary: true,
      translateBatch: async () => {
        throw coded;
      },
    };
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => provider },
    );
    // The raw provider error is caught and never surfaced: the locale succeeds with a notice and the
    // key is withheld for retry. No provider code or message leaks onto the summary.
    expect(summary.succeeded).toEqual(["de"]);
    expect(summary.locales[0]?.status).toBe("succeeded");
    expect(summary.locales[0]?.integrityMismatches).toEqual(["a"]);
    expect(summary.locales[0]?.notices.map((n) => n.code)).toContain("SUB_BATCH_FAILED");
    const noticeText = summary.locales[0]?.notices.map((n) => n.message).join(" ") ?? "";
    expect(noticeText).not.toContain("provider blew up");
  });

  it("captures a non-Error throw on a non-provider path as a structured LOCALE_FAILED summary", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const stub = makeStubProvider();
    // A non-Error thrown from the lock write (an SdkFs call, not the provider) still reaches the
    // structured per-locale failure path and falls back to the LOCALE_FAILED code.
    const fs = makeFakeFs({
      fileExists: (path: string) =>
        access(path)
          .then(() => true)
          .catch(() => false),
      writeFile: async () => {
        throw "raw failure";
      },
    });
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider, fs },
    );
    expect(summary.locales[0]?.error?.code).toBe("LOCALE_FAILED");
  });

  it("reports orphaned keys, does not translate or lock them", async () => {
    const dir = await project({ a: "A" }, { de: { a: "da", extra: "x" } });
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );
    expect(summary.locales[0]?.orphaned).toEqual(["extra"]);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.extra).toBe("x"); // not deleted
    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(lock.locales.de?.extra).toBeUndefined(); // orphaned -> no lock entry
    expect(lock.locales.de?.a).toBeDefined();
  });
});

describe("translate: glossary routing and notices", () => {
  it("passes the term-map to an LLM provider", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const stub = makeStubProvider({ kind: "llm" });
    await translate(
      { config: cfg({ glossary: { hello: "hallo" } }), cwd: dir },
      { createProvider: () => stub.provider },
    );
    expect(stub.calls[0]?.request.glossary).toEqual({ hello: "hallo" });
  });

  it("surfaces provider notices (e.g. DeepL GLOSSARY_IGNORED) to the caller", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const stub = makeStubProvider({
      kind: "machine-translation",
      notices: [{ code: "GLOSSARY_IGNORED", message: "term map ignored" }],
    });
    const summary = await translate(
      { config: cfg({ glossary: { hello: "hallo" } }), cwd: dir },
      { createProvider: () => stub.provider },
    );
    // the SDK still passes the term-map; DeepL ignores it and emits the notice
    expect(stub.calls[0]?.request.glossary).toEqual({ hello: "hallo" });
    expect(summary.locales[0]?.notices.map((n) => n.code)).toContain("GLOSSARY_IGNORED");
  });
});

describe("translate: plural-category warning (B4)", () => {
  it("warns per-locale when the target needs more plural categories than the source supplies", async () => {
    const dir = await project(
      { item_one: "1 item", item_other: "{count} items" },
      { ar: undefined },
    );
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg({ targetLocales: ["ar"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    const arabic = summary.locales.find((s) => s.locale === "ar");
    expect(arabic?.status).toBe("succeeded"); // the warning does not fail the run
    expect(arabic?.notices.map((n) => n.code)).toContain("PLURAL_CATEGORIES_INCOMPLETE");
  });

  it("does not warn when the target language is satisfied by one/other (en -> de)", async () => {
    const dir = await project(
      { item_one: "1 item", item_other: "{count} items" },
      { de: undefined },
    );
    const stub = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.locales[0]?.notices.map((n) => n.code)).not.toContain(
      "PLURAL_CATEGORIES_INCOMPLETE",
    );
  });
});

describe("translate: round-trip fidelity and dry-run", () => {
  it("changes only translated values and preserves existing key order", async () => {
    const dir = await project(
      { greeting: "Hello", farewell: "Bye" },
      { de: { greeting: "Hallo" } },
    );
    const stub = makeStubProvider();
    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });
    const text = await readTextFile(targetPath(dir, "de"));
    expect(text.indexOf('"greeting"')).toBeLessThan(text.indexOf('"farewell"'));
    expect(text).toContain('"greeting": "Hallo"');
  });

  it("dry-run reads + diffs + reports but calls no provider and writes nothing", async () => {
    const dir = await project({ a: "A", b: "B" }, { de: { a: "da" } });
    // no createProvider and no env key: proves the provider is not even constructed in dry-run
    const summary = await translate({ config: cfg(), cwd: dir, dryRun: true });

    expect(summary.dryRun).toBe(true);
    expect(summary.locales[0]?.translated).toEqual(["b"]); // what WOULD be translated
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de).toEqual({ a: "da" }); // unchanged
    expect(await exists(join(dir, "verbatra.lock.json"))).toBe(false); // no lock write
  });
});
