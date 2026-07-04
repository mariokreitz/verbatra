import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import {
  baseConfig,
  makeIntegrityProvider,
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

function lockPath(dir: string): string {
  return join(dir, "verbatra.lock.json");
}

type LockShape = { locales: Record<string, Record<string, string>> };

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["pl"], ...overrides });

const PLURAL_SOURCE = { items_one: "{{count}} item", items_other: "{{count}} items" };

function hasNotice(notices: readonly { code: string }[]): boolean {
  return notices.some((n) => n.code === "PLURAL_CATEGORIES_INCOMPLETE");
}

describe("translate: plural-category generation (supported case)", () => {
  it("generates every required category for a richer target and clears the warning", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    // pl requires one, few, many, other. one/other are translated; few/many are generated.
    expect(pl.items_one).toBeDefined();
    expect(pl.items_other).toBeDefined();
    expect(pl.items_few).toBeDefined();
    expect(pl.items_many).toBeDefined();

    const locale = summary.locales[0];
    expect(locale?.generated).toEqual(["items_few", "items_many"]);
    expect(locale?.translated).toEqual(["items_one", "items_other"]);
    expect(hasNotice(locale?.notices ?? [])).toBe(false);
  });

  it("generated forms carry the source placeholder set; a mismatch is withheld and the warning remains", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    // items_few fails integrity; the set stays incomplete so the warning remains.
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      {
        createProvider: () => makeStubProvider({ failIntegrity: new Set(["items_few"]) }).provider,
      },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined();
    expect(pl.items_many).toBeDefined();

    const locale = summary.locales[0];
    expect(locale?.generated).toEqual(["items_many"]);
    expect(locale?.integrityMismatches).toEqual(["items_few"]);
    expect(hasNotice(locale?.notices ?? [])).toBe(true);
  });
});

describe("translate: divergent source placeholders across plural categories", () => {
  // items_one carries an extra {{unit}} that items_other omits; items_other is the preferred representative, so generated forms are integrity-checked against its {{count}}-only set.
  const DIVERGENT = { items_one: "{{count}} {{unit}}", items_other: "{{count}} items" };
  // Seeded source forms are unchanged with no lock baseline, so they are not re-translated; only the generated few/many forms flow through the integrity provider.
  const SEEDED_TARGET = { items_one: "{{count}} sztuka", items_other: "{{count}} sztuk" };

  it("validates a generated form against the _other representative set and writes a matching form", async () => {
    const dir = await project(DIVERGENT, { pl: SEEDED_TARGET });

    // Produce a value carrying exactly the representative ({{count}}) set: matches, so it is written.
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeIntegrityProvider((value) => `[pl] ${value}`) },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    // The representative is items_other ("{{count}} items"): the generated forms carry only {{count}}.
    expect(pl.items_few).toContain("{{count}}");
    expect(pl.items_few).not.toContain("{{unit}}");
    // The seeded source forms are untouched (unchanged), so only few/many are generated.
    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
    expect(summary.locales[0]?.translated).toEqual([]);
    expect(summary.locales[0]?.integrityMismatches).toEqual([]);
  });

  it("withholds a generated form whose placeholders match items_one but not the items_other representative", async () => {
    const dir = await project(DIVERGENT, { pl: SEEDED_TARGET });

    // The produced value adds {{unit}} (the non-representative items_one set), an extra placeholder against the items_other representative, so the generated forms are withheld.
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeIntegrityProvider((value) => `[pl] ${value} {{unit}}`) },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined();
    expect(pl.items_many).toBeUndefined();
    // The seeded source forms survive untouched (unchanged, not re-translated).
    expect(pl.items_one).toBe("{{count}} sztuka");
    expect(pl.items_other).toBe("{{count}} sztuk");
    expect(summary.locales[0]?.generated).toEqual([]);
    expect(summary.locales[0]?.translated).toEqual([]);
    expect(summary.locales[0]?.integrityMismatches).toEqual(["items_few", "items_many"]);
    // Set still incomplete, so the warning remains.
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(true);
  });
});

describe("translate: reordered placeholders in a generated plural form", () => {
  // The representative items_other form carries two placeholders; a generated form that reorders them is a valid same-multiset translation.
  const REORDER_SOURCE = { items_one: "{{count}} {{unit}}", items_other: "{{count}} {{unit}}" };
  // Seeded target forms are unchanged with no lock baseline, so only the generated few/many forms flow through the integrity provider.
  const REORDER_SEEDED = {
    items_one: "{{count}} {{unit}} eins",
    items_other: "{{count}} {{unit}} andere",
  };

  it("accepts and writes a generated form that reorders the representative placeholder multiset", async () => {
    const dir = await project(REORDER_SOURCE, { pl: REORDER_SEEDED });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      {
        createProvider: () =>
          makeIntegrityProvider((value) =>
            value.replace("{{count}} {{unit}}", "{{unit}} {{count}}"),
          ),
      },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBe("{{unit}} {{count}}");
    expect(pl.items_many).toBe("{{unit}} {{count}}");
    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
    expect(summary.locales[0]?.integrityMismatches).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(false);
  });
});

describe("translate: multiple plural base keys, mixed completeness", () => {
  it("warns and generates only for the incomplete base key, leaving the complete one untouched", async () => {
    // `done` is already complete for pl (one/few/many/other); `items` is missing few/many.
    const source = {
      done_one: "{{count}} done",
      done_few: "{{count}} done (few)",
      done_many: "{{count}} done (many)",
      done_other: "{{count}} done (other)",
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    };
    const dir = await project(source, { pl: {} });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    // Generation touches only the incomplete base: items_few / items_many, never any done_* key.
    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.done_few).toBeDefined(); // translated from source, not generated
    expect(pl.items_few).toBeDefined();
    // items is now complete too, so the per-base check clears the warning for the locale.
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(false);
  });

  it("keeps the warning when one base stays incomplete even though another is complete", async () => {
    const source = {
      done_one: "{{count}} done",
      done_few: "{{count}} done (few)",
      done_many: "{{count}} done (many)",
      done_other: "{{count}} done (other)",
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    };
    const dir = await project(source, { pl: {} });

    // items_few is withheld, so the items base stays incomplete and the warning must remain.
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      {
        createProvider: () => makeStubProvider({ failIntegrity: new Set(["items_few"]) }).provider,
      },
    );

    expect(summary.locales[0]?.generated).toEqual(["items_many"]);
    expect(summary.locales[0]?.integrityMismatches).toEqual(["items_few"]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(true);
  });
});

describe("translate: a language needing more than two missing categories (Arabic)", () => {
  it("generates each missing category with a mix of pass and withhold", async () => {
    // ar requires zero/one/two/few/many/other; source supplies one/other, so four are missing.
    const dir = await project(PLURAL_SOURCE, { ar: {} });

    // two and many are withheld for integrity; zero and few pass, exercising the per-item loop beyond two categories.
    const summary = await translate(
      { config: cfg({ targetLocales: ["ar"] }), cwd: dir, generatePlurals: true },
      {
        createProvider: () =>
          makeStubProvider({ failIntegrity: new Set(["items_two", "items_many"]) }).provider,
      },
    );

    const ar = (await readJsonFile(targetPath(dir, "ar"))) as Record<string, string>;
    expect(ar.items_zero).toBeDefined();
    expect(ar.items_few).toBeDefined();
    expect(ar.items_two).toBeUndefined();
    expect(ar.items_many).toBeUndefined();

    const locale = summary.locales[0];
    expect(locale?.generated).toEqual(["items_few", "items_zero"]);
    expect(locale?.integrityMismatches).toEqual(["items_many", "items_two"]);
    // Two required categories are still missing, so the warning remains.
    expect(hasNotice(locale?.notices ?? [])).toBe(true);
  });

  it("generates the full missing set for Arabic when all forms pass", async () => {
    const dir = await project(PLURAL_SOURCE, { ar: {} });

    const summary = await translate(
      { config: cfg({ targetLocales: ["ar"] }), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    const locale = summary.locales[0];
    expect(locale?.generated).toEqual(["items_few", "items_many", "items_two", "items_zero"]);
    expect(hasNotice(locale?.notices ?? [])).toBe(false);
  });
});

describe("translate: plural generation fallbacks (never a hard failure)", () => {
  it("DeepL provider: no generation, run succeeds, warning emitted", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      {
        createProvider: () =>
          makeStubProvider({ id: "deepl", kind: "machine-translation" }).provider,
      },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined();
    expect(summary.locales[0]?.status).toBe("succeeded");
    expect(summary.locales[0]?.generated).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(true);
  });

  it("non-i18next format: generation is a no-op, run succeeds, no notice", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    const summary = await translate(
      { config: cfg({ format: "vue-i18n-json" }), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.status).toBe("succeeded");
    expect(summary.locales[0]?.generated).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(false);
  });

  it("unknown language: no generation, treated as {one, other}, run succeeds, no notice", async () => {
    const dir = await project(PLURAL_SOURCE, { xx: {} });

    const summary = await translate(
      { config: cfg({ targetLocales: ["xx"] }), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    const xx = (await readJsonFile(targetPath(dir, "xx"))) as Record<string, string>;
    expect(xx.items_few).toBeUndefined();
    expect(summary.locales[0]?.status).toBe("succeeded");
    expect(summary.locales[0]?.generated).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(false);
  });
});

describe("translate: plural generation no-change cases", () => {
  it("source already complete: no new keys, no extra forms, no notice", async () => {
    const complete = {
      items_one: "{{count}} item",
      items_few: "{{count}} few",
      items_many: "{{count}} many",
      items_other: "{{count}} items",
    };
    const dir = await project(complete, { pl: {} });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.generated).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(false);
  });

  it("a non-plural key is never considered for generation", async () => {
    const dir = await project({ greeting: "Hello" }, { pl: {} });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(Object.keys(pl).some((k) => k.includes("_few"))).toBe(false);
    expect(summary.locales[0]?.generated).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(false);
  });

  it("generation disabled (default): behavior is identical to today (warn, generate nothing)", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined();
    expect(summary.locales[0]?.generated).toEqual([]);
    expect(hasNotice(summary.locales[0]?.notices ?? [])).toBe(true);
  });

  it("the config option alone enables generation (no per-run override)", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    const summary = await translate(
      { config: cfg({ generatePlurals: true }), cwd: dir },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
  });

  it("the per-run override takes precedence over the config option", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    const summary = await translate(
      { config: cfg({ generatePlurals: false }), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
  });
});

describe("translate: plural generation lock and re-run", () => {
  it("a generated key is not regenerated on a second identical run", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );
    const second = makeStubProvider();
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => second.provider },
    );

    expect(summary.locales[0]?.generated).toEqual([]);
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeDefined();
    const lock = (await readJsonFile(lockPath(dir))) as LockShape;
    expect(lock.locales.pl?.items_few).toBeDefined();
  });

  it("changing a governing source plural form reconsiders the generated forms next run", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    // Change the source other-form: the generated few/many are derived from it, so they must be reconsidered.
    await writeJsonFile(join(dir, "locales", "en.json"), {
      items_one: "{{count}} item",
      items_other: "{{count}} ITEMS CHANGED",
    });
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
  });

  it("a withheld generated key is retried on the next run", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      {
        createProvider: () => makeStubProvider({ failIntegrity: new Set(["items_few"]) }).provider,
      },
    );
    // Next run, integrity passes: items_few must be retried (it was never locked as complete).
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.generated).toContain("items_few");
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeDefined();
  });

  it("generated keys are not pruned as orphans", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });

    await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeStubProvider().provider },
    );
    // Second run with prune on: generated few/many are not source keys, but must not be removed.
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true, prune: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.pruned).toEqual([]);
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeDefined();
    expect(pl.items_many).toBeDefined();
  });
});

describe("translate: plural generation determinism", () => {
  it("two runs over identical inputs produce the same key-set and byte-identical lock-file", async () => {
    const build = async (): Promise<{ generated: readonly string[]; lock: string }> => {
      const dir = await project(PLURAL_SOURCE, { pl: {} });
      const summary = await translate(
        { config: cfg(), cwd: dir, generatePlurals: true },
        { createProvider: () => makeStubProvider().provider },
      );
      return {
        generated: summary.locales[0]?.generated ?? [],
        lock: await readTextFile(lockPath(dir)),
      };
    };

    const run1 = await build();
    const run2 = await build();
    expect(run1.generated).toEqual(run2.generated);
    expect(run1.lock).toBe(run2.lock);
  });
});

describe("translate: generation off does not protect a source-absent plural-shaped key from pruning", () => {
  // The target carries a stale items_few with no corresponding source form; with generation off it is a true orphan, reported and (with prune on) removed.
  const STALE_TARGET = {
    items_one: "{{count}} sztuka",
    items_other: "{{count}} sztuk",
    items_few: "{{count}} sztuki",
  };

  it("reports and prunes the stale items_few when generation is off and prune is on", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: STALE_TARGET });

    const summary = await translate(
      { config: cfg(), cwd: dir, prune: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.orphaned).toEqual(["items_few"]);
    expect(summary.locales[0]?.pruned).toEqual(["items_few"]);
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined();
    expect(pl.items_one).toBe("{{count}} sztuka");
    expect(pl.items_other).toBe("{{count}} sztuk");
  });

  it("a prior lock entry for the pruned items_few does not survive when generation is off", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: STALE_TARGET });
    // Seed a lock that wrongly carries an entry for the soon-to-be-pruned items_few key.
    await writeFile(
      lockPath(dir),
      `${JSON.stringify({ version: 1, locales: { pl: { items_few: "leftover" } } }, null, 2)}\n`,
      "utf8",
    );

    await translate(
      { config: cfg(), cwd: dir, prune: true },
      { createProvider: () => makeStubProvider().provider },
    );

    const lock = (await readJsonFile(lockPath(dir))) as LockShape;
    expect(lock.locales.pl?.items_few).toBeUndefined();
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined();
  });

  it("the same stale items_few is protected (not orphaned, not pruned) when generation is on", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: STALE_TARGET });

    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true, prune: true },
      { createProvider: () => makeStubProvider().provider },
    );

    expect(summary.locales[0]?.orphaned).toEqual([]);
    expect(summary.locales[0]?.pruned).toEqual([]);
    // The key is protected from pruning because its base has source plural forms; it is regenerated this run, but the point is it is never reported or pruned.
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeDefined();
  });
});

const GENERATION_PASS: PlaceholderIntegrityResult = {
  matches: true,
  missing: [],
  extra: [],
  reordered: false,
};

/** An LLM provider that throws whenever the request carries `throwKey`, otherwise translates normally. */
function throwingKeyProvider(throwKey: string): {
  provider: TranslationProvider;
  calls: TranslateRequest[];
} {
  const calls: TranslateRequest[] = [];
  const provider: TranslationProvider = {
    id: "throwing",
    kind: "llm",
    supportsGlossary: true,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      calls.push(request);
      if (request.entries.some((entry) => entry.key === throwKey)) {
        throw Object.assign(new Error("generation sub-batch blew up"), { code: "PROVIDER_ERROR" });
      }
      const values = new Map<string, string>();
      const integrity = new Map<string, PlaceholderIntegrityResult>();
      for (const entry of request.entries) {
        values.set(entry.key, `[${request.targetLocale}] ${entry.value}`);
        integrity.set(entry.key, GENERATION_PASS);
      }
      return { values, integrity };
    },
  };
  return { provider, calls };
}

describe("translate: plural generation respects maxBatchSize", () => {
  it("splits a large stale generation set into multiple bounded provider requests", async () => {
    // ar requires zero/one/two/few/many/other; the target already carries one/other (unchanged, no
    // baseline), so only the four missing forms (zero, two, few, many) are stale. maxBatchSize of 2
    // must split them into two requests of at most 2 entries each, never one oversized call.
    const dir = await project(PLURAL_SOURCE, {
      ar: { items_one: "seeded one", items_other: "seeded other" },
    });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg({ targetLocales: ["ar"], maxBatchSize: 2 }), cwd: dir, generatePlurals: true },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(2);
    for (const call of stub.calls) {
      expect(call.request.entries.length).toBeLessThanOrEqual(2);
    }
    const sentKeys = stub.calls.flatMap((c) => c.request.entries.map((e) => e.key));
    expect(sentKeys.sort()).toEqual(["items_few", "items_many", "items_two", "items_zero"]);
    expect(new Set(sentKeys).size).toBe(sentKeys.length);
    expect(summary.locales[0]?.generated).toEqual([
      "items_few",
      "items_many",
      "items_two",
      "items_zero",
    ]);
  });

  it("issues a single generation request when the stale set is at or below maxBatchSize", async () => {
    const dir = await project(PLURAL_SOURCE, { pl: {} });
    const stub = makeStubProvider();

    await translate(
      { config: cfg({ maxBatchSize: 50 }), cwd: dir, generatePlurals: true },
      { createProvider: () => stub.provider },
    );

    // pl needs only few/many beyond one/other, and those two are also translated in one call, so the
    // stale generation set (2 items) fits in a single request under the default-sized batch.
    const generationCalls = stub.calls.filter((c) =>
      c.request.entries.every((e) => e.key === "items_few" || e.key === "items_many"),
    );
    expect(generationCalls).toHaveLength(1);
  });
});

describe("translate: a failed plural-generation sub-batch does not discard accepted work", () => {
  it("withholds only the thrown sub-batch's forms; main translations and the other sub-batch survive", async () => {
    // ar: four stale forms (zero, two, few, many) chunked at size 2 -> [zero, two] then [few, many].
    // The first sub-batch throws; main translations (items_one, items_other, newly missing) must still
    // be accepted and written, and the second generation sub-batch must still succeed.
    const dir = await project(PLURAL_SOURCE, { ar: {} });
    const { provider, calls } = throwingKeyProvider("items_two");

    const summary = await translate(
      { config: cfg({ targetLocales: ["ar"], maxBatchSize: 2 }), cwd: dir, generatePlurals: true },
      { createProvider: () => provider },
    );

    expect(summary.locales[0]?.status).toBe("succeeded");
    // Main translations, paid for before generation ever runs, are not discarded by the later failure.
    expect([...(summary.locales[0]?.translated ?? [])].sort()).toEqual([
      "items_one",
      "items_other",
    ]);
    // Only the thrown sub-batch's forms are withheld; the other sub-batch is accepted.
    expect(summary.locales[0]?.generated).toEqual(["items_few", "items_many"]);
    expect([...(summary.locales[0]?.integrityMismatches ?? [])].sort()).toEqual([
      "items_two",
      "items_zero",
    ]);
    expect(summary.locales[0]?.notices.map((n) => n.code)).toContain("SUB_BATCH_FAILED");

    const ar = (await readJsonFile(targetPath(dir, "ar"))) as Record<string, string>;
    expect(ar.items_one).toBeDefined();
    expect(ar.items_other).toBeDefined();
    expect(ar.items_few).toBeDefined();
    expect(ar.items_many).toBeDefined();
    expect(ar.items_zero).toBeUndefined();
    expect(ar.items_two).toBeUndefined();

    // The file was written even though a generation sub-batch threw: the run never aborted.
    expect(calls.length).toBeGreaterThan(1);
  });

  it("does not lock the withheld sub-batch's keys, so they retry next run", async () => {
    const dir = await project(PLURAL_SOURCE, { ar: {} });
    const { provider } = throwingKeyProvider("items_two");

    await translate(
      { config: cfg({ targetLocales: ["ar"], maxBatchSize: 2 }), cwd: dir, generatePlurals: true },
      { createProvider: () => provider },
    );

    const lock = (await readJsonFile(lockPath(dir))) as LockShape;
    expect(lock.locales.ar?.items_zero).toBeUndefined();
    expect(lock.locales.ar?.items_two).toBeUndefined();
    expect(lock.locales.ar?.items_few).toBeDefined();
    expect(lock.locales.ar?.items_many).toBeDefined();
    expect(lock.locales.ar?.items_one).toBeDefined();
    expect(lock.locales.ar?.items_other).toBeDefined();
  });
});
