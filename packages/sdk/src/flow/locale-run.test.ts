import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LocaleResource } from "@verbatra/core";
import { createDefaultRegistry, type FormatAdapter } from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import { defaultFs } from "../fs.js";
import { makeStubProvider, makeTempDir, readJsonFile, writeJsonFile } from "../test-support.js";
import { type LocaleRunParams, runLocale } from "./locale-run.js";

function i18nextAdapter(): FormatAdapter {
  const resolution = createDefaultRegistry().resolve("", { format: "i18next-json" });
  if (resolution.status !== "resolved") {
    throw new Error("i18next adapter did not resolve");
  }
  return resolution.adapter;
}

const adapter = i18nextAdapter();

/** Create a project on disk and read the source into core's IR via the real adapter. */
async function setup(
  source: Record<string, unknown>,
  target?: Record<string, unknown>,
): Promise<{ dir: string; sourceResource: LocaleResource }> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  if (target !== undefined) {
    await writeJsonFile(join(dir, "locales", "de.json"), target);
  }
  const sourceResource = (await adapter.read(join(dir, "locales", "en.json"), "en")).resource;
  return { dir, sourceResource };
}

function makeParams(
  base: { source: LocaleResource; cwd: string },
  overrides: Partial<LocaleRunParams> = {},
): LocaleRunParams {
  return {
    source: base.source,
    sourceInvalidIcuKeys: [],
    baseline: new Map(),
    adapter,
    provider: makeStubProvider().provider,
    cwd: base.cwd,
    filesPattern: "locales/{locale}.json",
    sourceLocale: "en",
    targetLocale: "de",
    format: "i18next-json",
    glossary: undefined,
    tone: undefined,
    prune: false,
    generatePlurals: false,
    maxBatchSize: 50,
    fs: defaultFs,
    ...overrides,
  };
}

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", `${locale}.json`);
}

describe("runLocale: dry-run", () => {
  it("reports what would be translated and writes nothing, with no lock entries", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" }, { a: "da" });
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider: undefined });

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual(["b"]); // missing key that WOULD be translated
    expect(summary.unchanged).toEqual(["a"]);
    expect(lockEntries).toEqual({});
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de).toEqual({ a: "da" }); // untouched
  });
});

describe("runLocale: translate and write", () => {
  it("translates the missing keys, writes the file, and locks every written key", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" });
    const stub = makeStubProvider();
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider: stub.provider });

    const { summary, lockEntries } = await runLocale(params);

    expect([...summary.translated].sort()).toEqual(["a", "b"]);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de).toEqual({ a: "[de] A", b: "[de] B" });
    expect(Object.keys(lockEntries).sort()).toEqual(["a", "b"]);
  });
});

describe("runLocale: withholding", () => {
  it("withholds a whole sub-batch when the provider call throws and surfaces a notice", async () => {
    const { dir, sourceResource } = await setup({ a: "A" });
    const throwing = makeStubProvider({ throwForLocales: new Set(["de"]) });
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: throwing.provider },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual([]);
    expect(summary.integrityMismatches).toEqual(["a"]);
    expect(summary.notices.map((n) => n.code)).toContain("SUB_BATCH_FAILED");
    expect(lockEntries).toEqual({}); // nothing locked, so it retries next run
  });

  it("withholds a key whose translation fails the integrity check", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" });
    const stub = makeStubProvider({ failIntegrity: new Set(["a"]) });
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider: stub.provider });

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual(["b"]);
    expect(summary.integrityMismatches).toEqual(["a"]);
    expect(lockEntries.a).toBeUndefined(); // withheld, no prior baseline to carry
    expect(lockEntries.b).toBeDefined();
  });

  it("carries the prior baseline hash for a withheld changed key (withheld-carry)", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" }, { a: "[de] old", b: "[de] B" });
    const stub = makeStubProvider({ failIntegrity: new Set(["a"]) });
    // Baseline marks `a` as changed (stale hash) and `b` as up to date so only `a` is a candidate.
    const baseline = new Map([
      ["a", "stale-hash"],
      ["b", "matches-but-unused"],
    ]);
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, baseline },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.integrityMismatches).toEqual(["a"]);
    expect(lockEntries.a).toBe("stale-hash"); // prior hash carried so it retries next run
  });
});

describe("runLocale: invalid-ICU source keys", () => {
  it("skips invalid-ICU candidate keys, reports them, and never locks them", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" });
    const stub = makeStubProvider();
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, sourceInvalidIcuKeys: ["a"] },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.invalidIcuSource).toEqual(["a"]);
    expect(summary.translated).toEqual(["b"]); // only the valid key is sent
    expect(stub.calls.flatMap((c) => c.request.entries.map((e) => e.key))).toEqual(["b"]);
    expect(lockEntries.a).toBeUndefined();
    expect(lockEntries.b).toBeDefined();
  });
});

describe("runLocale: pruning and orphans", () => {
  it("prunes an orphaned key from the file and the lock when prune is on", async () => {
    const { dir, sourceResource } = await setup({ a: "A" }, { a: "da", orphan: "x" });
    const stub = makeStubProvider();
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, prune: true },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.orphaned).toEqual(["orphan"]);
    expect(summary.pruned).toEqual(["orphan"]);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.orphan).toBeUndefined();
    expect(lockEntries.orphan).toBeUndefined();
  });

  it("keeps an orphaned key when prune is off and never gives it a lock entry", async () => {
    const { dir, sourceResource } = await setup({ a: "A" }, { a: "da", orphan: "x" });
    const stub = makeStubProvider();
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider: stub.provider });

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.orphaned).toEqual(["orphan"]);
    expect(summary.pruned).toEqual([]);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.orphan).toBe("x"); // source-absent key left in place (orphaned-no-entry)
    expect(lockEntries.orphan).toBeUndefined();
  });
});

describe("runLocale: plural generation", () => {
  it("synthesizes the missing CLDR plural forms a richer target needs and locks them", async () => {
    const { dir, sourceResource } = await setup({
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    });
    const stub = makeStubProvider();
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, targetLocale: "pl", generatePlurals: true },
    );

    const { summary, lockEntries } = await runLocale(params);

    // Polish needs one/few/many/other; the source supplies one/other, so few and many are generated.
    expect(summary.generated).toEqual(["items_few", "items_many"]);
    const pl = (await readJsonFile(targetPath(dir, "pl"))) as Record<string, string>;
    expect(pl.items_few).toBeDefined();
    expect(pl.items_many).toBeDefined();
    expect(lockEntries.items_few).toBeDefined();
    expect(lockEntries.items_many).toBeDefined();
  });

  it("keeps an orphaned generated-plural-shaped target key out of orphaned and pruned", async () => {
    // The target carries a source-absent plural-shaped key (items_few) and a genuine orphan. With
    // generation on, items_few is a generated form (not a true orphan) and must stay out of orphaned;
    // the genuine orphan is still reported. This exercises the generated-plural protection filter and
    // the non-generated early return of the lock-carry helper.
    const { dir, sourceResource } = await setup({
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    });
    // The shared setup writes the target as de.json; this case targets pl, so write the pl target here.
    await writeJsonFile(targetPath(dir, "pl"), { items_few: "x", orphan: "y" });
    const stub = makeStubProvider();
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, targetLocale: "pl", generatePlurals: true },
    );

    const { summary, lockEntries } = await runLocale(params);

    // items_few is filtered out of orphaned (it is a generated form); only the genuine orphan remains.
    expect(summary.orphaned).toEqual(["orphan"]);
    expect(summary.pruned).toEqual([]);
    // The genuine orphan is source-absent and not plural-shaped, so the lock-carry helper returns early
    // and never gives it a lock entry.
    expect(lockEntries.orphan).toBeUndefined();
    // items_few is regenerated this run, so it does get a fresh lock entry.
    expect(lockEntries.items_few).toBeDefined();
  });

  it("carries the prior baseline lock hash for a previously generated plural key not regenerated", async () => {
    // First run generates the Polish forms and locks them. A second run with that lock as baseline must
    // skip regeneration (the governing source forms are unchanged) yet carry the prior lock hash forward,
    // so the generated key's lock entry survives. This exercises the carry-prior-hash branch.
    const { dir, sourceResource } = await setup({
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    });
    const stub = makeStubProvider();
    const firstParams = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, targetLocale: "pl", generatePlurals: true },
    );
    const first = await runLocale(firstParams);
    expect(first.summary.generated).toEqual(["items_few", "items_many"]);

    const baseline = new Map(Object.entries(first.lockEntries));
    const secondParams = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, targetLocale: "pl", generatePlurals: true, baseline },
    );
    const second = await runLocale(secondParams);

    // Nothing is regenerated, but the prior lock hashes are carried forward unchanged.
    expect(second.summary.generated).toEqual([]);
    expect(second.lockEntries.items_few).toBe(first.lockEntries.items_few);
    expect(second.lockEntries.items_many).toBe(first.lockEntries.items_many);
  });

  it("re-emits the incomplete warning when generation cannot complete the plural set", async () => {
    // Polish needs one/few/many/other. Generation withholds items_many (integrity failure), so the
    // written set stays incomplete and the PLURAL_CATEGORIES_INCOMPLETE warning is re-emitted.
    const { dir, sourceResource } = await setup({
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    });
    const stub = makeStubProvider({ failIntegrity: new Set(["items_many"]) });
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, targetLocale: "pl", generatePlurals: true },
    );

    const { summary } = await runLocale(params);

    expect(summary.generated).toEqual(["items_few"]);
    expect(summary.integrityMismatches).toContain("items_many");
    expect(summary.notices.map((n) => n.code)).toContain("PLURAL_CATEGORIES_INCOMPLETE");
  });

  it("emits no plural warning for a non-i18next format when generation is on", async () => {
    // The post-generation plural-warning recompute is an i18next-only concern: a non-i18next format
    // takes the early-return path and produces no plural notice.
    const { dir, sourceResource } = await setup({
      items_one: "{{count}} item",
      items_other: "{{count}} items",
    });
    const stub = makeStubProvider();
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: stub.provider, format: "vue-i18n-json", generatePlurals: true },
    );

    const { summary } = await runLocale(params);

    expect(summary.notices.map((n) => n.code)).not.toContain("PLURAL_CATEGORIES_INCOMPLETE");
  });
});
