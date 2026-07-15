import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createAnthropicProvider,
  ProviderError,
  type TranslationProvider,
} from "@verbatra/ai-providers";
import type { LocaleResource, PlaceholderIntegrityResult } from "@verbatra/core";
import {
  createDefaultRegistry,
  createNextIntlJsonAdapter,
  type FormatAdapter,
} from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import { defaultFs } from "../fs.js";
import {
  makeIntegrityProvider,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../test-support.js";
import { createBudgetTracker } from "./budget.js";
import { type LocaleRunParams, runLocale } from "./locale-run.js";

/**
 * A real Anthropic provider (through the shared LLM layer) wired to a stub client that returns the
 * given per-key translations as a forced tool-use response, exactly the shape the real SDK returns. Used
 * to exercise the real ai-providers integrity path end to end, not a hand-rolled double of it.
 */
function anthropicStubProvider(
  translations: ReadonlyArray<{ key: string; value: string }>,
): TranslationProvider {
  return createAnthropicProvider(
    { model: "claude-sonnet-4-5", maxTokens: 1024 },
    {
      client: {
        messages: {
          create: () =>
            Promise.resolve({
              content: [
                {
                  type: "tool_use",
                  id: "t1",
                  name: "submit_translations",
                  input: { translations },
                },
              ],
            }),
        },
      },
    },
  );
}

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

/** Like {@link setup}, but reads the source through a caller-supplied adapter (for ICU formats). */
async function setupWithAdapter(
  targetAdapter: FormatAdapter,
  source: Record<string, unknown>,
): Promise<{ dir: string; sourceResource: LocaleResource }> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  const sourceResource = (await targetAdapter.read(join(dir, "locales", "en.json"), "en")).resource;
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
    budget: createBudgetTracker(undefined, "warn"),
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
    expect(de).toEqual({ a: "da" });
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
  it("reports a thrown provider call under providerFailures, not integrityMismatches", async () => {
    const { dir, sourceResource } = await setup({ a: "A" });
    const throwing = makeStubProvider({ throwForLocales: new Set(["de"]) });
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: throwing.provider },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual([]);
    expect(summary.providerFailures).toEqual(["a"]);
    expect(summary.integrityMismatches).toEqual([]); // nothing was translated, so it is not an integrity mismatch
    expect(summary.notices.map((n) => n.code)).toContain("SUB_BATCH_FAILED");
    expect(lockEntries).toEqual({}); // nothing locked, so it retries next run
  });

  it("carries a thrown ProviderError's secret-free code and message onto the notice", async () => {
    const { dir, sourceResource } = await setup({ a: "A" });
    const error = new ProviderError(
      "MISSING_API_KEY",
      "The ANTHROPIC_API_KEY variable is not set.",
    );
    const throwing = makeStubProvider({ throwForLocales: new Set(["de"]), error });
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: throwing.provider },
    );

    const { summary } = await runLocale(params);

    expect(summary.providerFailures).toEqual(["a"]);
    const notice = summary.notices.find((n) => n.code === "SUB_BATCH_FAILED");
    expect(notice?.message).toContain("MISSING_API_KEY");
    expect(notice?.message).toContain("The ANTHROPIC_API_KEY variable is not set.");
  });

  it("never leaks a raw non-ProviderError message onto the notice", async () => {
    const { dir, sourceResource } = await setup({ a: "A" });
    const error = Object.assign(new Error("secret request body leaked here"), {
      code: "PROVIDER_ERROR",
    });
    const throwing = makeStubProvider({ throwForLocales: new Set(["de"]), error });
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider: throwing.provider },
    );

    const { summary } = await runLocale(params);

    expect(summary.providerFailures).toEqual(["a"]);
    const noticeText = summary.notices.map((n) => n.message).join(" ");
    expect(noticeText).not.toContain("secret request body leaked here");
    expect(noticeText).toContain("PROVIDER_CALL_FAILED");
  });

  it("withholds a key still missing from the response under providerFailures, not integrityMismatches", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" });
    // The provider call succeeds but returns no value at all for "a" (the shared LLM layer's bounded
    // reconcile repair round already retried it once and it stayed missing), distinct from a value
    // that came back and failed the placeholder-integrity check.
    const stub = makeStubProvider({ missingValues: new Set(["a"]) });
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider: stub.provider });

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual(["b"]);
    expect(summary.providerFailures).toEqual(["a"]);
    expect(summary.integrityMismatches).toEqual([]);
    expect(lockEntries.a).toBeUndefined(); // withheld, no prior baseline to carry
    expect(lockEntries.b).toBeDefined();
  });

  it("carries the prior baseline hash for a key still missing from the response (withheld-carry)", async () => {
    const { dir, sourceResource } = await setup({ a: "A", b: "B" }, { a: "[de] old", b: "[de] B" });
    const stub = makeStubProvider({ missingValues: new Set(["a"]) });
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

    expect(summary.providerFailures).toEqual(["a"]);
    // The lock baseline never advances for a key that was not actually translated this run.
    expect(lockEntries.a).toBe("stale-hash"); // prior hash carried so it retries next run
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

describe("runLocale: reordered placeholders", () => {
  it("accepts and writes a translation that reorders the same placeholder multiset", async () => {
    const { dir, sourceResource } = await setup({ pair: "{{a}} {{b}}" });
    // The provider renders the source with the placeholders swapped: a valid same-multiset reorder.
    const provider = makeIntegrityProvider((value) =>
      value.replace("{{a}} {{b}}", "{{b}} und {{a}}"),
    );
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider });

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual(["pair"]);
    expect(summary.integrityMismatches).toEqual([]);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.pair).toBe("{{b}} und {{a}}");
    expect(lockEntries.pair).toBeDefined();
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
    expect(summary.translated).toEqual(["b"]);
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
    // With generation on, a source-absent plural-shaped key (items_few) is a generated form, not a true orphan, so only the genuine orphan is reported.
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
    // The genuine orphan is source-absent and not plural-shaped, so it never gets a lock entry.
    expect(lockEntries.orphan).toBeUndefined();
    // items_few is regenerated this run, so it does get a fresh lock entry.
    expect(lockEntries.items_few).toBeDefined();
  });

  it("carries the prior baseline lock hash for a previously generated plural key not regenerated", async () => {
    // A second run with the prior lock as baseline skips regeneration yet carries the prior lock hash forward.
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
    // Generation withholds items_many (integrity failure), so the set stays incomplete and the warning is re-emitted.
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
    // The post-generation plural-warning recompute is i18next-only, so a non-i18next format produces no plural notice.
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

describe("runLocale: ICU branch-aware comparePlaceholders wiring (real ai-providers call site)", () => {
  const nextIntl = createNextIntlJsonAdapter();

  it("flags a placeholder invented in a single target branch as an integrity mismatch, not accepted", async () => {
    const { dir, sourceResource } = await setupWithAdapter(nextIntl, {
      items: "{count, plural, one {# item} other {# items}}",
    });
    const provider = anthropicStubProvider([
      { key: "items", value: "{count, plural, one {# item} other {# items by {author}}}" },
    ]);
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider, adapter: nextIntl, format: "next-intl-json" },
    );

    const { summary, lockEntries } = await runLocale(params);

    // A flat, non-branch-aware comparison would flatten this to a match; the real ai-providers
    // integrity path must reject it via the adapter's comparePlaceholders.
    expect(summary.translated).toEqual([]);
    expect(summary.integrityMismatches).toEqual(["items"]);
    expect(lockEntries.items).toBeUndefined();
  });

  it("still flags a placeholder dropped from a single target branch as an integrity mismatch", async () => {
    const { dir, sourceResource } = await setupWithAdapter(nextIntl, {
      items: "{count, plural, one {# by {author}} other {# by {author}}}",
    });
    const provider = anthropicStubProvider([
      { key: "items", value: "{count, plural, one {# by {author}} other {#}}" },
    ]);
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider, adapter: nextIntl, format: "next-intl-json" },
    );

    const { summary } = await runLocale(params);

    expect(summary.integrityMismatches).toEqual(["items"]);
  });

  it("accepts a correct translation that keeps a source-only-partial placeholder in its matching branch", async () => {
    const { dir, sourceResource } = await setupWithAdapter(nextIntl, {
      msg: "{count, plural, one {One msg from {sender}} other {# messages}}",
    });
    const provider = anthropicStubProvider([
      {
        key: "msg",
        value: "{count, plural, one {Eine Nachricht von {sender}} other {# Nachrichten}}",
      },
    ]);
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider, adapter: nextIntl, format: "next-intl-json" },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual(["msg"]);
    expect(summary.integrityMismatches).toEqual([]);
    expect(lockEntries.msg).toBeDefined();
    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(de.msg).toBe("{count, plural, one {Eine Nachricht von {sender}} other {# Nachrichten}}");
  });
});

describe("runLocale: gateCandidateValue's validateMessage delta", () => {
  const nextIntl = createNextIntlJsonAdapter();

  it("withholds a candidate that passes placeholder comparison but fails ICU syntax validation", async () => {
    // Plain-text source (no ICU syntax at all): the placeholder-comparison fallback trivially
    // matches on both sides being empty. Before this refactor, ai-providers' checkBatchIntegrity
    // only ran comparePlaceholders, so this candidate was accepted despite its unbalanced brace;
    // gateCandidateValue's added validateMessage call now withholds it.
    const { dir, sourceResource } = await setupWithAdapter(nextIntl, { greeting: "Hello world" });
    const provider = anthropicStubProvider([{ key: "greeting", value: "Hallo {name" }]);
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider, adapter: nextIntl, format: "next-intl-json" },
    );

    const { summary, lockEntries } = await runLocale(params);

    expect(summary.translated).toEqual([]);
    expect(summary.integrityMismatches).toEqual(["greeting"]);
    expect(lockEntries.greeting).toBeUndefined(); // withheld, keeps its prior baseline and retries
  });

  it("keeps the placeholder dimension unchanged: a well-formed ICU candidate is still accepted or withheld purely on its placeholders", async () => {
    const { dir, sourceResource } = await setupWithAdapter(nextIntl, {
      dropped: "{count, plural, one {# by {author}} other {# by {author}}}",
      matching: "{count, plural, one {One} other {# items}}",
    });
    const provider = anthropicStubProvider([
      // Well-formed ICU, but drops a placeholder from one branch: still a placeholder rejection.
      { key: "dropped", value: "{count, plural, one {# by {author}} other {#}}" },
      // Well-formed ICU with matching placeholders: still accepted.
      { key: "matching", value: "{count, plural, one {Eins} other {# Elemente}}" },
    ]);
    const params = makeParams(
      { source: sourceResource, cwd: dir },
      { provider, adapter: nextIntl, format: "next-intl-json" },
    );

    const { summary } = await runLocale(params);

    expect(summary.integrityMismatches).toEqual(["dropped"]);
    expect(summary.translated).toEqual(["matching"]);
  });

  it("keeps the non-ICU placeholder dimension unchanged: validateMessage is unconditionally true and never withholds", async () => {
    const { dir, sourceResource } = await setup({ a: "Hello {{name}}" });
    const stub = makeStubProvider({ failIntegrity: new Set(["a"]) });
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider: stub.provider });

    const { summary } = await runLocale(params);

    expect(summary.integrityMismatches).toEqual(["a"]);
  });
});

describe("runLocale: needsReview (real ai-providers reviewFlags call site)", () => {
  it("folds reviewFlags into needsReview, sorted by key", async () => {
    const { dir, sourceResource } = await setup({ b: "Hello there", a: "Good day" });
    const provider = anthropicStubProvider([
      { key: "b", value: "Hello there" },
      { key: "a", value: "Good day" },
    ]);
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider });

    const { summary } = await runLocale(params);

    expect([...summary.translated].sort()).toEqual(["a", "b"]);
    expect(summary.needsReview).toEqual([
      { key: "a", reasons: ["EQUALS_SOURCE"] },
      { key: "b", reasons: ["EQUALS_SOURCE"] },
    ]);
  });

  it("never reports a key withheld by the integrity check, even if it also carried a review flag", async () => {
    const { dir, sourceResource } = await setup({
      long: "This is a fairly long source with {{ph}} inside",
    });
    // Drops the placeholder (integrity mismatch, withheld) and is far shorter than the source
    // (independently trips LENGTH_RATIO_OUTLIER), so the key gets a review flag despite being withheld.
    const provider = anthropicStubProvider([{ key: "long", value: "hi" }]);
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider });

    const { summary } = await runLocale(params);

    expect(summary.integrityMismatches).toEqual(["long"]);
    expect(summary.translated).toEqual([]);
    expect(summary.needsReview).toEqual([]);
  });

  it("reports an empty needsReview when the provider flags nothing", async () => {
    const { dir, sourceResource } = await setup({ a: "Hi there" });
    const provider = anthropicStubProvider([{ key: "a", value: "Hallo dort" }]);
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider });

    const { summary } = await runLocale(params);

    expect(summary.translated).toEqual(["a"]);
    expect(summary.needsReview).toEqual([]);
  });

  it("merges reviewFlags across multiple sub-batches, each with its own TranslateResult", async () => {
    const { dir, sourceResource } = await setup({ b: "Hello there", a: "Good day" });
    // A hand-rolled provider (not the real ai-providers heuristic) that sets a distinct reviewFlags
    // entry per call, so a batch size of 1 exercises two independent TranslateResults to fold.
    const provider: TranslationProvider = {
      id: "stub",
      kind: "llm",
      supportsGlossary: false,
      translateBatch: async (request) => {
        const values = new Map<string, string>();
        const integrity = new Map<string, PlaceholderIntegrityResult>();
        const reviewFlags = new Map<
          string,
          { status: "review"; reasons: readonly ["EQUALS_SOURCE"] }
        >();
        for (const entry of request.entries) {
          values.set(entry.key, entry.value);
          integrity.set(entry.key, { matches: true, missing: [], extra: [], reordered: false });
          reviewFlags.set(entry.key, { status: "review", reasons: ["EQUALS_SOURCE"] });
        }
        return { values, integrity, reviewFlags };
      },
    };
    const params = makeParams({ source: sourceResource, cwd: dir }, { provider, maxBatchSize: 1 });

    const { summary } = await runLocale(params);

    expect(summary.needsReview).toEqual([
      { key: "a", reasons: ["EQUALS_SOURCE"] },
      { key: "b", reasons: ["EQUALS_SOURCE"] },
    ]);
  });
});
