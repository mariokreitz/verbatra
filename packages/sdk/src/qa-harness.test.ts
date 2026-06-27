import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { contentHash } from "@verbatra/core";
import { createDefaultRegistry } from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import { translate } from "./flow/translate-project.js";
import { baseConfig, makeStubProvider, makeTempDir, readJsonFile } from "./test-support.js";

async function projectWithSource(sourceRaw: string): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeFile(join(dir, "locales", "en.json"), sourceRaw, "utf8");
  return dir;
}

type Lock = { locales: Record<string, Record<string, string>> };

describe("QA independent: invalid-ICU source handling", () => {
  it("skips an invalid-ICU source key for translation, does not write or lock it, reports it", async () => {
    // 'bad' is valid JSON but invalid ICU (plural missing the 'other' clause).
    const dir = await projectWithSource(
      JSON.stringify({ ok: "Hello {name}", bad: "{n, plural, one {x}}" }),
    );
    const stub = makeStubProvider();

    const summary = await translate(
      { config: baseConfig({ format: "next-intl-json", targetLocales: ["de"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    const locale = summary.locales[0];
    expect(locale?.invalidIcuSource).toEqual(["bad"]);
    expect(locale?.translated).toEqual(["ok"]);
    expect(stub.calls[0]?.request.entries.map((e) => e.key)).toEqual(["ok"]);

    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(de.ok).toBe("[de] Hello {name}");
    expect(de.bad).toBeUndefined();

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as Lock;
    expect(lock.locales.de?.ok).toBeDefined();
    expect(lock.locales.de?.bad).toBeUndefined(); // not lock-updated, so it retries once the ICU is fixed
  });
});

describe("QA independent: malformed existing target", () => {
  it("is a per-locale failure (distinct from an absent target), run continues", async () => {
    const dir = await projectWithSource(JSON.stringify({ a: "A" }));
    await writeFile(join(dir, "locales", "de.json"), "{ broken json", "utf8");
    const stub = makeStubProvider();

    const summary = await translate(
      { config: baseConfig({ targetLocales: ["de"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    expect(summary.failed).toEqual(["de"]);
    expect(summary.locales[0]?.error?.code).toBeDefined();
    const lock = (await readJsonFile(join(dir, "verbatra.lock.json")).catch(() => undefined)) as
      | Lock
      | undefined;
    expect(lock?.locales.de).toBeUndefined();
  });
});

describe("QA independent: corrupt lock-file is a whole-run error", () => {
  it("a corrupt verbatra.lock.json makes translate() fail LOCK_FILE_INVALID and not proceed", async () => {
    const dir = await projectWithSource(JSON.stringify({ a: "A" }));
    await writeFile(join(dir, "verbatra.lock.json"), "{ corrupt", "utf8");
    const stub = makeStubProvider();

    await expect(
      translate(
        { config: baseConfig({ targetLocales: ["de"] }), cwd: dir },
        { createProvider: () => stub.provider },
      ),
    ).rejects.toMatchObject({ code: "LOCK_FILE_INVALID" });

    // the run did not proceed: no target file was written
    const wrote = await access(join(dir, "locales", "de.json")).then(
      () => true,
      () => false,
    );
    expect(wrote).toBe(false);
    expect(stub.calls).toHaveLength(0);
  });
});

describe("QA independent: lock reuses core contentHash", () => {
  it("the lock value for a key equals core.contentHash of the source entry", async () => {
    const dir = await projectWithSource(JSON.stringify({ a: "Hello {{name}}" }));
    const stub = makeStubProvider();
    await translate(
      { config: baseConfig({ targetLocales: ["de"] }), cwd: dir },
      { createProvider: () => stub.provider },
    );

    const registry = createDefaultRegistry();
    const resolution = registry.resolve("", { format: "i18next-json" });
    if (resolution.status !== "resolved") {
      throw new Error("adapter did not resolve");
    }
    const { resource } = await resolution.adapter.read(join(dir, "locales", "en.json"), "en");
    const entry = resource.entries.get("a");
    if (entry === undefined) {
      throw new Error("source entry missing");
    }

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as Lock;
    expect(lock.locales.de?.a).toBe(contentHash(entry));
  });
});
