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
import { baseConfig, makeStubProvider, makeTempDir, readJsonFile } from "../test-support.js";
import { translate } from "./translate-project.js";

const PASS: PlaceholderIntegrityResult = {
  matches: true,
  missing: [],
  extra: [],
  reordered: false,
};

async function project(
  source: Record<string, unknown>,
  targets: Record<string, Record<string, unknown> | undefined>,
): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeFile(join(dir, "locales", "en.json"), `${JSON.stringify(source, null, 2)}\n`, "utf8");
  for (const [locale, obj] of Object.entries(targets)) {
    if (obj !== undefined) {
      await writeFile(
        join(dir, "locales", `${locale}.json`),
        `${JSON.stringify(obj, null, 2)}\n`,
        "utf8",
      );
    }
  }
  return dir;
}

function keyedSource(count: number): Record<string, string> {
  const source: Record<string, string> = {};
  for (let index = 0; index < count; index += 1) {
    source[`k${index}`] = `v${index}`;
  }
  return source;
}

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de"], ...overrides });

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", `${locale}.json`);
}

async function readLock(dir: string): Promise<Record<string, Record<string, string>>> {
  const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
    locales: Record<string, Record<string, string>>;
  };
  return lock.locales;
}

describe("translate: sub-batch chunking, success path", () => {
  it("splits a locale over the maximum into multiple bounded translateBatch calls", async () => {
    const dir = await project(keyedSource(7), { de: undefined });
    const stub = makeStubProvider();

    await translate(
      { config: cfg({ maxBatchSize: 3 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls.map((c) => c.request.entries.length)).toEqual([3, 3, 1]);
    for (const call of stub.calls) {
      expect(call.request.entries.length).toBeLessThanOrEqual(3);
    }
  });

  it("sends every entry exactly once across the sub-batches (no drop, no duplicate)", async () => {
    const dir = await project(keyedSource(7), { de: undefined });
    const stub = makeStubProvider();

    await translate(
      { config: cfg({ maxBatchSize: 3 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    const sent = stub.calls.flatMap((c) => c.request.entries.map((e) => e.key));
    expect(sent.sort()).toEqual(["k0", "k1", "k2", "k3", "k4", "k5", "k6"]);
    expect(new Set(sent).size).toBe(sent.length);
  });

  it("writes one file with every accepted translation and a fresh lock hash for every key", async () => {
    const dir = await project(keyedSource(5), { de: undefined });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    for (let index = 0; index < 5; index += 1) {
      expect(de[`k${index}`]).toBe(`[de] v${index}`);
    }
    expect([...(summary.locales[0]?.translated ?? [])].sort()).toEqual([
      "k0",
      "k1",
      "k2",
      "k3",
      "k4",
    ]);
    const lock = await readLock(dir);
    expect(Object.keys(lock.de ?? {}).sort()).toEqual(["k0", "k1", "k2", "k3", "k4"]);
  });

  it("issues exactly one call when the entry count is at or below the maximum", async () => {
    const dir = await project(keyedSource(3), { de: undefined });
    const stub = makeStubProvider();

    await translate(
      { config: cfg({ maxBatchSize: 3 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.request.entries.length).toBe(3);
  });

  it("matches the un-chunked result for the same set (same file, same lock keys)", async () => {
    const source = keyedSource(6);
    const chunkedDir = await project(source, { de: undefined });
    const wholeDir = await project(source, { de: undefined });

    await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: chunkedDir },
      { createProvider: () => makeStubProvider().provider },
    );
    await translate(
      { config: cfg({ maxBatchSize: 100 }), cwd: wholeDir },
      { createProvider: () => makeStubProvider().provider },
    );

    const chunkedFile = (await readJsonFile(targetPath(chunkedDir, "de"))) as Record<
      string,
      string
    >;
    const wholeFile = (await readJsonFile(targetPath(wholeDir, "de"))) as Record<string, string>;
    expect(chunkedFile).toEqual(wholeFile);
    expect(Object.keys((await readLock(chunkedDir)).de ?? {}).sort()).toEqual(
      Object.keys((await readLock(wholeDir)).de ?? {}).sort(),
    );
  });
});

function throwingBatchProvider(throwKey: string): {
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
      if (request.entries.some((e) => e.key === throwKey)) {
        throw Object.assign(new Error("sub-batch blew up"), { code: "PROVIDER_ERROR" });
      }
      const values = new Map<string, string>();
      const integrity = new Map<string, PlaceholderIntegrityResult>();
      for (const entry of request.entries) {
        values.set(entry.key, `[${request.targetLocale}] ${entry.value}`);
        integrity.set(entry.key, PASS);
      }
      return { values, integrity };
    },
  };
  return { provider, calls };
}

describe("translate: sub-batch chunking, failure isolation", () => {
  it("keeps the locale succeeded when one sub-batch throws; others are written, only the failed keys withheld", async () => {
    const dir = await project(keyedSource(4), { de: undefined });
    const { provider } = throwingBatchProvider("k2");

    const summary = await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => provider },
    );

    expect(summary.locales[0]?.status).toBe("succeeded");
    expect([...(summary.locales[0]?.translated ?? [])].sort()).toEqual(["k0", "k1"]);
    expect([...(summary.locales[0]?.providerFailures ?? [])].sort()).toEqual(["k2", "k3"]);
    expect(summary.locales[0]?.integrityMismatches).toEqual([]);

    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.k0).toBe("[de] v0");
    expect(de.k1).toBe("[de] v1");
    expect(de.k2).toBeUndefined();
    expect(de.k3).toBeUndefined();
  });

  it("does not lock a failed sub-batch's keys, so they remain eligible for retry", async () => {
    const dir = await project(keyedSource(4), { de: undefined });
    const { provider } = throwingBatchProvider("k2");

    await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => provider },
    );

    const lock = await readLock(dir);
    expect(Object.keys(lock.de ?? {}).sort()).toEqual(["k0", "k1"]);
  });

  it("surfaces a chunk-level provider failure as a notice without throwing out of the locale", async () => {
    const dir = await project(keyedSource(4), { de: undefined });
    const { provider } = throwingBatchProvider("k2");

    const summary = await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => provider },
    );

    const notices = summary.locales[0]?.notices ?? [];
    expect(notices.map((n) => n.code)).toContain("SUB_BATCH_FAILED");
    expect(notices.map((n) => n.message).join(" ")).not.toContain("sub-batch blew up");
  });

  it("withholds only the integrity-failing sub-batch's keys; passing sub-batches are accepted and locked", async () => {
    const dir = await project(keyedSource(4), { de: undefined });
    const stub = makeStubProvider({ failIntegrity: new Set(["k3"]) });

    const summary = await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect([...(summary.locales[0]?.translated ?? [])].sort()).toEqual(["k0", "k1", "k2"]);
    expect(summary.locales[0]?.integrityMismatches).toEqual(["k3"]);
    const lock = await readLock(dir);
    expect(Object.keys(lock.de ?? {}).sort()).toEqual(["k0", "k1", "k2"]);
  });
});

describe("translate: sub-batch chunking, forward progress", () => {
  it("re-requests only the previously-failed keys after a partial failure", async () => {
    const dir = await project(keyedSource(4), { de: undefined });

    const first = throwingBatchProvider("k2");
    await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => first.provider },
    );

    const second = makeStubProvider();
    const run2 = await translate(
      { config: cfg({ maxBatchSize: 2 }), cwd: dir },
      { createProvider: () => second.provider },
    );

    const sent = second.calls.flatMap((c) => c.request.entries.map((e) => e.key));
    expect(sent.sort()).toEqual(["k2", "k3"]);
    expect([...(run2.locales[0]?.translated ?? [])].sort()).toEqual(["k2", "k3"]);
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de.k2).toBe("[de] v2");
    expect(de.k3).toBe("[de] v3");
    expect(Object.keys((await readLock(dir)).de ?? {}).sort()).toEqual(["k0", "k1", "k2", "k3"]);
  });
});

describe("translate: sub-batch chunking default", () => {
  it("uses one request for a small locale when maxBatchSize is omitted", async () => {
    const dir = await project(keyedSource(10), { de: undefined });
    const stub = makeStubProvider();

    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.request.entries.length).toBe(10);
  });
});
