import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { baseConfig, makeStubProvider, makeTempDir, writeJsonFile } from "../test-support.js";
import { translate } from "./translate-project.js";

const NESTED_PATTERN = "locales/{locale}/common.json";

function cfg(overrides: Partial<VerbatraConfig> = {}): VerbatraConfig {
  return baseConfig({
    targetLocales: ["de"],
    files: { pattern: NESTED_PATTERN },
    ...overrides,
  });
}

async function nestedProject(source: Record<string, unknown>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales", "en"), { recursive: true });
  await writeJsonFile(join(dir, "locales", "en", "common.json"), source);
  return dir;
}

function targetPath(dir: string, locale: string): string {
  return join(dir, "locales", locale, "common.json");
}

describe("translate: a locale whose directory does not exist yet", () => {
  it("creates the directory and writes the target", async () => {
    const dir = await nestedProject({ greeting: "Hello" });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg(), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.failed).toEqual([]);
    expect(summary.locales[0]?.translated).toEqual(["greeting"]);
    expect(JSON.parse(await readFile(targetPath(dir, "de"), "utf8"))).toEqual({
      greeting: "[de] Hello",
    });
  });

  it("creates a directory per locale when several are added at once", async () => {
    const dir = await nestedProject({ greeting: "Hello" });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: cfg({ targetLocales: ["de", "fr", "es"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.failed).toEqual([]);
    for (const locale of ["de", "fr", "es"]) {
      expect(JSON.parse(await readFile(targetPath(dir, locale), "utf8"))).toEqual({
        greeting: `[${locale}] Hello`,
      });
    }
  });

  it("still writes an existing target, so the flat layout is unaffected", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeJsonFile(join(dir, "locales", "en.json"), { greeting: "Hello" });
    const stub = makeStubProvider();

    const summary = await translate(
      { config: baseConfig({ targetLocales: ["de"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.failed).toEqual([]);
    expect(JSON.parse(await readFile(join(dir, "locales", "de.json"), "utf8"))).toEqual({
      greeting: "[de] Hello",
    });
  });
});
