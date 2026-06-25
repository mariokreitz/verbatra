import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  TranslateRequest,
  TranslateResult,
  TranslationProvider,
} from "@verbatra/ai-providers";
import { checkPlaceholders, type PlaceholderIntegrityResult } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
} from "../test-support.js";
import { translate } from "./translate-project.js";

/**
 * An LLM provider that mirrors the real integrity path: it extracts the source entry's placeholders
 * (which, for a generated form, are the chosen REPRESENTATIVE source plural form's placeholders) and the
 * produced value's placeholders, and reports integrity from comparing the two. `produce` decides the
 * output value per key, so a test can make a generated form carry a placeholder set that does or does not
 * match the representative. This lets the divergent-placeholder case assert WHICH source form the
 * generated form is validated against, without the keyed-failIntegrity shortcut of the shared stub.
 */
function makeIntegrityProvider(
  produce: (entryValue: string, key: string) => string,
): TranslationProvider {
  return {
    id: "stub",
    kind: "llm",
    supportsGlossary: true,
    translateBatch: async (request: TranslateRequest): Promise<TranslateResult> => {
      const values = new Map<string, string>();
      const integrity = new Map<string, PlaceholderIntegrityResult>();
      for (const entry of request.entries) {
        const value = produce(entry.value, entry.key);
        values.set(entry.key, value);
        integrity.set(
          entry.key,
          checkPlaceholders(
            request.extractPlaceholders(entry.value),
            request.extractPlaceholders(value),
          ),
        );
      }
      return { values, integrity };
    },
  };
}

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
    expect(pl.items_few).toBeUndefined(); // withheld, not written
    expect(pl.items_many).toBeDefined(); // the passing form is written

    const locale = summary.locales[0];
    expect(locale?.generated).toEqual(["items_many"]);
    expect(locale?.integrityMismatches).toEqual(["items_few"]);
    expect(hasNotice(locale?.notices ?? [])).toBe(true);
  });
});

describe("translate: divergent source placeholders across plural categories", () => {
  // items_one carries an extra {{unit}} that items_other omits. The representative is items_other
  // (preferred), so a generated form is integrity-checked against ITS set ({{count}} only): a generated
  // value that reproduces only {{count}} passes, and one that adds {{unit}} (matching the non-representative
  // items_one) is withheld as an extra placeholder. This pins the representative-form choice. The
  // documented assumption (real i18next plural forms share the count placeholder) holds; divergent extra
  // placeholders in a non-representative form are intentionally not propagated, not silently written.
  const DIVERGENT = { items_one: "{{count}} {{unit}}", items_other: "{{count}} items" };
  // Seed the target with the source plural forms already present and placeholder-valid. With no lock
  // baseline for these keys, the diff reports them as unchanged (see core diffResources): they are NOT
  // re-translated, so they never pass through the integrity provider below. Only the generated few/many
  // forms flow through it, which isolates the behavior under test (a generated form is validated against
  // the items_other representative set, not the non-representative items_one set).
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

    // Produce a value that ADDS {{unit}} (the non-representative items_one set). Against the items_other
    // representative ({{count}} only) this is an extra placeholder, so the form is withheld. The seeded
    // source forms are unchanged and not re-translated, so they never reach the injecting stub: only the
    // generated few/many forms are withheld, isolating the representative-set check under test.
    const summary = await translate(
      { config: cfg(), cwd: dir, generatePlurals: true },
      { createProvider: () => makeIntegrityProvider((value) => `[pl] ${value} {{unit}}`) },
    );

    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeUndefined(); // withheld, not written
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
    // The complete base did not by itself mask the incomplete one, but here items is now complete too,
    // so the per-base check clears the warning for the locale.
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

    // two and many are withheld for integrity; zero and few pass. This exercises the per-item loop
    // beyond two categories and a partial result.
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
    expect(ar.items_two).toBeUndefined(); // withheld
    expect(ar.items_many).toBeUndefined(); // withheld

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
    // The generated keys are still present in the file and the lock.
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
  // Source has only items_one / items_other. The target carries a stale items_few (a leftover a prior
  // generation-on run may have written) that has no corresponding source form. With generation OFF (the
  // default) this is a true orphan: it must be reported and, with prune on, removed.
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
    // The key is protected from pruning (its base has source plural forms). With no prior lock entry it
    // is also regenerated this run, but the point under test is that it is never reported/pruned.
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeDefined();
  });
});
