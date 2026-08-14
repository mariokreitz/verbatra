import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../test-support.js";
import { translate } from "./translate-project.js";

async function project(source: Record<string, unknown>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  return dir;
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
  baseConfig({ targetLocales: ["de", "fr", "es"], ...overrides });

describe("translate: locale subset", () => {
  it("runs only the requested locales and leaves the others untouched", async () => {
    const dir = await project({ a: "A" });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg(), cwd: dir, locales: ["fr"] },
      { createProvider: () => stub.provider },
    );

    expect(summary.locales.map((entry) => entry.locale)).toEqual(["fr"]);
    expect(await exists(join(dir, "locales", "fr.json"))).toBe(true);
    expect(await exists(join(dir, "locales", "de.json"))).toBe(false);
    expect(await exists(join(dir, "locales", "es.json"))).toBe(false);
  });

  it("keeps the configured target order rather than the requested order", async () => {
    const dir = await project({ a: "A" });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg(), cwd: dir, locales: ["es", "de"] },
      { createProvider: () => stub.provider },
    );

    expect(summary.locales.map((entry) => entry.locale)).toEqual(["de", "es"]);
  });

  it("leaves the other locales' lock entries alone", async () => {
    const dir = await project({ a: "A" });
    const stub = makeStubProvider();

    await translate({ config: cfg(), cwd: dir }, { createProvider: () => stub.provider });
    await writeJsonFile(join(dir, "locales", "en.json"), { a: "A2" });
    await translate(
      { config: cfg(), cwd: dir, locales: ["de"] },
      { createProvider: () => stub.provider },
    );

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    expect(lock.locales.de).toBeDefined();
    expect(lock.locales.fr).toBeDefined();
    expect(lock.locales.es).toBeDefined();
  });

  it("throws UNKNOWN_LOCALE before constructing a provider", async () => {
    const dir = await project({ a: "A" });
    let constructed = 0;

    await expect(
      translate(
        { config: cfg(), cwd: dir, locales: ["de", "zz"] },
        {
          createProvider: () => {
            constructed += 1;
            return makeStubProvider().provider;
          },
        },
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_LOCALE" });
    expect(constructed).toBe(0);
  });

  it("names the unknown locale and the configured targets", async () => {
    const dir = await project({ a: "A" });

    const error = await translate(
      { config: cfg(), cwd: dir, locales: ["zz"] },
      { createProvider: () => makeStubProvider().provider },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).message).toContain("zz");
    expect((error as SdkError).message).toContain("de, fr, es");
  });

  it("runs every configured locale when no subset is given", async () => {
    const dir = await project({ a: "A" });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.locales.map((entry) => entry.locale)).toEqual(["de", "fr", "es"]);
  });

  it("applies the subset on a dry run too", async () => {
    const dir = await project({ a: "A" });

    const summary = await translate({ config: cfg(), cwd: dir, dryRun: true, locales: ["es"] });

    expect(summary.locales.map((entry) => entry.locale)).toEqual(["es"]);
  });
});
