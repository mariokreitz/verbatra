import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AdapterRegistry } from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import {
  baseConfig,
  makeFakeFs,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
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

describe("translate: orchestration success", () => {
  it("translates every target locale, writing each file and updating the lock", async () => {
    const dir = await project({ a: "A" }, { de: undefined, fr: undefined });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg({ targetLocales: ["de", "fr"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.dryRun).toBe(false);
    expect([...summary.succeeded].sort()).toEqual(["de", "fr"]);
    expect(summary.failed).toEqual([]);
    expect(await exists(targetPath(dir, "de"))).toBe(true);
    expect(await exists(targetPath(dir, "fr"))).toBe(true);

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(lock.locales.de?.a).toBeDefined();
    expect(lock.locales.fr?.a).toBeDefined();
  });
});

describe("translate: dry-run", () => {
  it("never constructs the provider and writes neither the target nor the lock", async () => {
    const dir = await project({ a: "A", b: "B" }, { de: { a: "da" } });
    // A provider factory that throws if invoked proves dry-run never constructs the provider.
    const summary = await translate(
      { config: cfg(), cwd: dir, dryRun: true },
      {
        createProvider: () => {
          throw new Error("provider must not be constructed in dry-run");
        },
      },
    );

    expect(summary.dryRun).toBe(true);
    expect(summary.locales[0]?.translated).toEqual(["b"]); // what WOULD be translated
    const de = (await readJsonFile(targetPath(dir, "de"))) as Record<string, string>;
    expect(de).toEqual({ a: "da" }); // unchanged
    expect(await exists(join(dir, "verbatra.lock.json"))).toBe(false);
  });
});

describe("translate: per-locale isolation", () => {
  it("records a per-locale failure as a failed summary and continues the run", async () => {
    const dir = await project({ a: "A" }, { de: undefined, fr: undefined });
    const stub = makeStubProvider();
    // The lock write throws only for fr, isolating it as a failed locale while de still succeeds.
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

    expect(summary.succeeded).toEqual(["de"]);
    expect(summary.failed).toEqual(["fr"]);
    expect(summary.locales.find((s) => s.locale === "fr")?.error?.code).toBe("LOCK_FILE_WRITE");
  });
});

describe("translate: whole-run failures throw", () => {
  it("throws UNKNOWN_FORMAT when no adapter is registered for the format", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const stub = makeStubProvider();
    await expect(
      translate(
        { config: cfg(), cwd: dir },
        { createProvider: () => stub.provider, adapterRegistry: new AdapterRegistry() },
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_FORMAT" });
  });

  it("throws SOURCE_UNREADABLE when the source file is absent", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    const stub = makeStubProvider();
    await expect(
      translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider }),
    ).rejects.toMatchObject({ code: "SOURCE_UNREADABLE" });
  });

  it("throws SOURCE_INVALID when the source file cannot be parsed", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeFile(join(dir, "locales", "en.json"), "{ not valid json", "utf8");
    const stub = makeStubProvider();
    await expect(
      translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider }),
    ).rejects.toMatchObject({ code: "SOURCE_INVALID" });
  });
});
