import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { contentHash, type TranslationEntry } from "@verbatra/core";
import { buildWorkbook, readWorkbook } from "@verbatra/exchange";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../../config/schema.js";
import {
  baseConfig,
  makeFakeFs,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../../test-support.js";
import { check } from "../check.js";
import { exportWorkbook } from "./export-workbook.js";
import { importWorkbook } from "./import-workbook.js";

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de", "fr"], format: "i18next-json", ...overrides });

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

function entry(value: string, placeholders: readonly string[] = []): TranslationEntry {
  return { key: "k", namespace: "en", value, placeholders, isPlural: false };
}

async function fillWorkbook(
  path: string,
  locale: string,
  fills: Readonly<Record<string, string>>,
): Promise<void> {
  const data = await readWorkbook(new Uint8Array(await readFile(path)));
  const sheets = data.sheets.map((sheet) =>
    sheet.locale !== locale
      ? sheet
      : {
          locale: sheet.locale,
          rows: sheet.rows.map((row) =>
            fills[row.key] !== undefined ? { ...row, translation: fills[row.key] as string } : row,
          ),
        },
  );
  await writeFile(path, await buildWorkbook({ sheets }));
}

describe("exportWorkbook", () => {
  it("exports one sheet per target locale with missing-and-changed rows by default", async () => {
    const dir = await project(
      { greeting: "Hello", farewell: "Bye" },
      { de: { greeting: "Hallo" } },
    );
    const result = await exportWorkbook({ config: cfg(), cwd: dir });

    expect(result.path).toBe(join(dir, "verbatra-translations.xlsx"));
    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    expect(data.sheets.map((s) => s.locale)).toEqual(["de", "fr"]);
    // de is missing only "farewell" (greeting already present and unchanged with no baseline).
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["farewell"]);
    // fr has no target file: both keys are missing.
    expect(data.sheets[1]?.rows.map((r) => r.key)).toEqual(["farewell", "greeting"]);
  });

  it("carries the source hash and status, and is deterministic across runs", async () => {
    const dir = await project({ a: "A", b: "B" }, { de: undefined });
    const r1 = await exportWorkbook({ config: cfg({ targetLocales: ["de"] }), cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(r1.path)));
    const row = data.sheets[0]?.rows.find((r) => r.key === "a");
    expect(row?.status).toBe("new");
    expect(row?.sourceHash).toBe(contentHash(entry("A")));

    await exportWorkbook({ config: cfg({ targetLocales: ["de"] }), cwd: dir });
    const again = await readWorkbook(new Uint8Array(await readFile(r1.path)));
    expect(again.sheets[0]?.rows.map((r) => r.key)).toEqual(data.sheets[0]?.rows.map((r) => r.key));
  });

  it("honors --locales and --include-unchanged, labeling the included row 'unchanged'", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" }, fr: { a: "Af" } });
    const result = await exportWorkbook({
      config: cfg(),
      cwd: dir,
      locales: ["de"],
      includeUnchanged: true,
    });
    expect(result.locales.map((l) => l.locale)).toEqual(["de"]);
    // Unchanged "a" is included because of the opt-in.
    expect(result.locales[0]?.rows).toBe(1);

    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    const row = data.sheets[0]?.rows.find((r) => r.key === "a");
    // Must be labeled "unchanged", not "changed": the source never drifted.
    expect(row?.status).toBe("unchanged");
  });

  it("never emits an 'unchanged' status row when includeUnchanged is off or omitted", async () => {
    // "a" is already in sync (unchanged) and "b" is missing, so the default export carries one
    // "new" row and, absent the bug fix, would carry zero "unchanged" rows either way. Asserting
    // a non-empty sheet with no "unchanged" row makes this a real check, not a vacuous one.
    const dir = await project({ a: "A", b: "B" }, { de: { a: "Aa" } });
    const result = await exportWorkbook({ config: cfg({ targetLocales: ["de"] }), cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["b"]);
    expect(data.sheets[0]?.rows.some((r) => r.status === "unchanged")).toBe(false);
  });

  it("produces a valid empty workbook when nothing needs translation", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    const result = await exportWorkbook({ config: cfg({ targetLocales: ["de"] }), cwd: dir });
    expect(result.locales[0]?.rows).toBe(0);
    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    expect(data.sheets[0]?.rows).toHaveLength(0);
  });

  it("exports a baseline key whose source drifted with status 'changed'", async () => {
    // de already has "a" translated, and the lock records the OLD source hash. The live source
    // value has since changed, so diffResources classifies "a" as changed, not new.
    const dir = await project({ a: "A new" }, { de: { a: "Aa" } });
    const config = cfg({ targetLocales: ["de"] });
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { a: contentHash(entry("A old")) } },
    });

    const result = await exportWorkbook({ config, cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    const row = data.sheets[0]?.rows.find((r) => r.key === "a");
    expect(row?.status).toBe("changed");
    expect(row?.currentTarget).toBe("Aa");
  });

  it("rejects an unknown requested locale with UNKNOWN_LOCALE instead of silently dropping it", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" }, fr: { a: "Af" } });
    await expect(
      exportWorkbook({ config: cfg(), cwd: dir, locales: ["de", "es"] }),
    ).rejects.toMatchObject({ code: "UNKNOWN_LOCALE" });
  });

  it("carries the source entry's description into the Context column", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeJsonFile(join(dir, "locales", "en.arb"), {
      greeting: "Hello",
      "@greeting": { description: "A friendly greeting shown on the home screen" },
    });
    const config = cfg({
      targetLocales: ["de"],
      format: "arb",
      files: { pattern: "locales/{locale}.arb" },
    });

    const result = await exportWorkbook({ config, cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    const row = data.sheets[0]?.rows.find((r) => r.key === "greeting");
    expect(row?.context).toBe("A friendly greeting shown on the home screen");
  });

  it("leaves the Context column empty when the source entry carries no description", async () => {
    const dir = await project({ greeting: "Hello" }, { de: undefined });
    const result = await exportWorkbook({ config: cfg({ targetLocales: ["de"] }), cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(result.path)));
    const row = data.sheets[0]?.rows.find((r) => r.key === "greeting");
    expect(row?.context).toBe("");
  });
});

describe("importWorkbook", () => {
  it("writes accepted values by key, updates the lock, reports orphaned, and the summary", async () => {
    // de already carries an orphaned key (not in source); it is reported and never locked.
    const dir = await project(
      { greeting: "Hello", farewell: "Bye" },
      { de: { stale: "Veraltet" } },
    );
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { greeting: "Hallo", farewell: "Tschuss" });

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.succeeded).toEqual(["de"]);
    expect(summary.locales[0]?.translated).toEqual(["farewell", "greeting"]);
    expect(summary.locales[0]?.orphaned).toEqual(["stale"]);

    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(de.greeting).toBe("Hallo");
    expect(de.farewell).toBe("Tschuss");
    expect(de.stale).toBe("Veraltet");

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    // The orphaned key gets no lock entry; only the two source-present keys do.
    expect(Object.keys(lock.locales.de ?? {}).sort()).toEqual(["farewell", "greeting"]);
  });

  it("imports a legacy workbook built without the Context column", async () => {
    const dir = await project({ greeting: "Hello" }, { de: undefined });
    const config = cfg({ targetLocales: ["de"] });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("de");
    ["Key", "Source", "Current translation", "Status", "Translation", "Source hash"].forEach(
      (label, index) => {
        sheet.getRow(1).getCell(index + 1).value = label;
      },
    );
    sheet.getRow(2).getCell(1).value = "greeting";
    sheet.getRow(2).getCell(2).value = "Hello";
    sheet.getRow(2).getCell(4).value = "new";
    sheet.getRow(2).getCell(5).value = "Hallo";
    sheet.getRow(2).getCell(6).value = contentHash(entry("Hello"));
    const path = join(dir, "legacy.xlsx");
    await workbook.xlsx.writeFile(path);

    const summary = await importWorkbook({ config, workbook: path, cwd: dir });
    expect(summary.succeeded).toEqual(["de"]);
    expect(summary.locales[0]?.translated).toEqual(["greeting"]);
  });

  it("bootstraps a baseline for an already-synced key with no prior lock entry", async () => {
    // "a" is already in sync in de.json and there is no lock file yet, so it never appears as a
    // workbook row; only "b" is missing and gets exported and filled.
    const dir = await project({ a: "A", b: "B" }, { de: { a: "Aa" } });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { b: "Bb" });

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.translated).toEqual(["b"]);

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    // First run bootstraps "a"'s baseline to the current source hash, since there is no prior one.
    expect(lock.locales.de?.a).toBe(contentHash(entry("A")));
    expect(lock.locales.de?.b).toBe(contentHash(entry("B")));
  });

  it("skips empty cells: not written, no lock entry, never an empty string", async () => {
    const dir = await project({ a: "A", b: "B" }, { de: undefined });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { a: "Aa" }); // b left empty

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.translated).toEqual(["a"]);
    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(de.b).toBeUndefined();
  });

  it("withholds a placeholder mismatch: reported, not written, no lock entry", async () => {
    const dir = await project({ greet: "Hi {{name}}" }, { de: undefined });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { greet: "Hallo" }); // dropped {{name}}

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.integrityMismatches).toEqual(["greet"]);
    expect(summary.locales[0]?.translated).toEqual([]);
    // Nothing accepted: the target file is never written.
    await expect(readJsonFile(join(dir, "locales", "de.json"))).rejects.toThrow();
  });

  it("withholds invalid ICU for an ICU format", async () => {
    const dir = await project(
      { items: "{n, plural, one {# item} other {# items}}" },
      { de: undefined },
    );
    const config = cfg({ targetLocales: ["de"], format: "next-intl-json" });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { items: "{n, plural, one {x" }); // malformed ICU

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.integrityMismatches).toEqual(["items"]);
    expect(summary.locales[0]?.translated).toEqual([]);
  });

  it("withholds a drifted row when the source changed since export", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { a: "Aa" });
    // Source changes after export, before import.
    await writeJsonFile(join(dir, "locales", "en.json"), { a: "A changed" });

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.integrityMismatches).toEqual(["a"]);
    expect(summary.locales[0]?.translated).toEqual([]);
    // Drifted value is withheld: the target file is never written.
    await expect(readJsonFile(join(dir, "locales", "de.json"))).rejects.toThrow();
  });

  it("a withheld key with an existing target keeps its prior lock hash (not refreshed)", async () => {
    // de already has greet translated; a prior lock records the OLD source hash.
    const dir = await project({ greet: "Hi {{name}}" }, { de: { greet: "Hallo {{name}}" } });
    const config = cfg({ targetLocales: ["de"] });
    const priorHash = contentHash(entry("Old source", ["{{name}}"]));
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { greet: priorHash } },
    });
    // greet is changed (source hash != prior), so it exports; the translator drops {{name}}.
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { greet: "Hallo" });

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.integrityMismatches).toEqual(["greet"]);

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    // Withheld: the lock keeps the prior hash, so greet re-exports next run.
    expect(lock.locales.de?.greet).toBe(priorHash);
    // The existing translation is untouched on disk.
    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(de.greet).toBe("Hallo {{name}}");
  });

  it("keeps the prior lock baseline when a changed row is left blank", async () => {
    // de already has "greeting" translated; the lock records the source hash at that time.
    const dir = await project({ greeting: "Hello" }, { de: { greeting: "Hallo" } });
    const config = cfg({ targetLocales: ["de"] });
    const priorHash = contentHash(entry("Hello"));
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: { de: { greeting: priorHash } },
    });
    // The source changes after the lock was recorded, so "greeting" exports as changed.
    await writeJsonFile(join(dir, "locales", "en.json"), { greeting: "Hi there" });
    const out = await exportWorkbook({ config, cwd: dir });

    // The translator leaves the cell blank (the exported row already has an empty translation).
    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.translated).toEqual([]);

    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    // The target file is untouched: still the translation of the OLD source.
    expect(de.greeting).toBe("Hallo");

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    // The baseline must not advance to the new source hash: check/diff must keep reporting drift.
    expect(lock.locales.de?.greeting).toBe(priorHash);
    expect(lock.locales.de?.greeting).not.toBe(contentHash(entry("Hi there")));

    expect(summary.locales[0]?.notices).toEqual([
      expect.objectContaining({ code: "BLANK_ROW_BASELINE_RETAINED" }),
    ]);

    // The acceptance criterion is phrased in check terms: de must still report the drift, not 0 stale.
    const checked = await check({ config, cwd: dir });
    expect(checked.locales[0]?.stale).toBe(1);
    expect(checked.inSync).toBe(false);
  });

  it("keeps every locale's prior baseline when the whole workbook is left blank", async () => {
    const dir = await project(
      { greeting: "Hello", farewell: "Bye" },
      {
        de: { greeting: "Hallo", farewell: "Tschuss" },
        fr: { greeting: "Salut", farewell: "Adieu" },
      },
    );
    const config = cfg({ targetLocales: ["de", "fr"] });
    const priorGreeting = contentHash(entry("Hello"));
    const priorFarewell = contentHash(entry("Bye"));
    await writeJsonFile(join(dir, "verbatra.lock.json"), {
      version: 1,
      locales: {
        de: { greeting: priorGreeting, farewell: priorFarewell },
        fr: { greeting: priorGreeting, farewell: priorFarewell },
      },
    });
    // Both source strings change after the lock was recorded.
    await writeJsonFile(join(dir, "locales", "en.json"), {
      greeting: "Hi there",
      farewell: "Goodbye",
    });
    const out = await exportWorkbook({ config, cwd: dir });

    // The entire workbook is imported untouched: every cell stays blank for every locale.
    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales.map((l) => l.translated)).toEqual([[], []]);

    const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
      locales: Record<string, Record<string, string>>;
    };
    for (const locale of ["de", "fr"]) {
      expect(lock.locales[locale]?.greeting).toBe(priorGreeting);
      expect(lock.locales[locale]?.farewell).toBe(priorFarewell);
    }

    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    const fr = (await readJsonFile(join(dir, "locales", "fr.json"))) as Record<string, string>;
    expect(de).toEqual({ greeting: "Hallo", farewell: "Tschuss" });
    expect(fr).toEqual({ greeting: "Salut", farewell: "Adieu" });

    for (const localeSummary of summary.locales) {
      expect(localeSummary.notices).toEqual([
        expect.objectContaining({ code: "BLANK_ROW_BASELINE_RETAINED" }),
      ]);
    }

    // Every locale must still report both keys as stale, matching the acceptance criterion.
    const checked = await check({ config, cwd: dir });
    expect(checked.inSync).toBe(false);
    expect(checked.locales.map((l) => l.stale)).toEqual([2, 2]);
  });

  it("accepts a filled 'unchanged' row exactly like a 'changed' row, branching on no status", async () => {
    const dir = await project({ a: "A" }, { de: { a: "Aa" } });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir, includeUnchanged: true });
    await fillWorkbook(out.path, "de", { a: "Aa updated" });

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.translated).toEqual(["a"]);
    const de = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(de.a).toBe("Aa updated");
  });

  it("dry-run validates and reports without writing the locale or the lock", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    await fillWorkbook(out.path, "de", { a: "Aa" });

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir, dryRun: true });
    expect(summary.dryRun).toBe(true);
    expect(summary.locales[0]?.translated).toEqual(["a"]);
    // Nothing written: no target file, no lock file.
    await expect(readJsonFile(join(dir, "locales", "de.json"))).rejects.toThrow();
    await expect(readJsonFile(join(dir, "verbatra.lock.json"))).rejects.toThrow();
  });

  it("fails the locale for a sheet whose locale is not in the config", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    // Export with de+es, then import against a config that only knows de.
    const exportConfig = cfg({ targetLocales: ["de", "es"] });
    const out = await exportWorkbook({ config: exportConfig, cwd: dir });
    await fillWorkbook(out.path, "es", { a: "Ae" });

    const summary = await importWorkbook({
      config: cfg({ targetLocales: ["de"] }),
      workbook: out.path,
      cwd: dir,
    });
    const es = summary.locales.find((l) => l.locale === "es");
    expect(es?.status).toBe("failed");
    expect(es?.error?.code).toBe("CONFIG_INVALID");
  });

  it("fails the locale for an unknown key that maps to no source or target", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const config = cfg({ targetLocales: ["de"] });
    const out = await exportWorkbook({ config, cwd: dir });
    // Forge an extra row with an invented key.
    const data = await readWorkbook(new Uint8Array(await readFile(out.path)));
    const sheets = data.sheets.map((sheet) =>
      sheet.locale !== "de"
        ? sheet
        : {
            locale: sheet.locale,
            rows: [
              ...sheet.rows.map((r) => ({ ...r, translation: "Aa" })),
              {
                key: "ghost",
                source: "",
                currentTarget: "",
                status: "new" as const,
                sourceHash: "x",
                translation: "Boo",
                context: "",
              },
            ],
          },
    );
    await writeFile(out.path, await buildWorkbook({ sheets }));

    const summary = await importWorkbook({ config, workbook: out.path, cwd: dir });
    expect(summary.locales[0]?.status).toBe("failed");
    expect(summary.locales[0]?.error?.code).toBe("LOCALE_FAILED");
  });

  it("reports a missing workbook as a structured SOURCE_UNREADABLE", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    await expect(
      importWorkbook({
        config: cfg({ targetLocales: ["de"] }),
        workbook: join(dir, "absent.xlsx"),
        cwd: dir,
      }),
    ).rejects.toMatchObject({ code: "SOURCE_UNREADABLE" });
  });

  it("rejects a structurally invalid workbook as a structured SOURCE_INVALID", async () => {
    const dir = await project({ a: "A" }, { de: undefined });
    const path = join(dir, "bad.xlsx");
    await writeFile(path, new Uint8Array([1, 2, 3]));
    await expect(
      importWorkbook({ config: cfg({ targetLocales: ["de"] }), workbook: path, cwd: dir }),
    ).rejects.toMatchObject({ code: "SOURCE_INVALID" });
  });

  it("rejects an over-cap workbook (on-disk gate) as a structured SOURCE_INVALID", async () => {
    // project() writes a real en.json the adapter reads; fileExists is faked true and only the
    // workbook's bounded read reports too-large, so the on-disk gate fires before any sheet work.
    const dir = await project({ a: "A" }, { de: undefined });
    const fs = makeFakeFs({
      fileExists: async () => true,
      readBytesBounded: async () => ({ kind: "too-large" }),
    });
    await expect(
      importWorkbook(
        { config: cfg({ targetLocales: ["de"] }), workbook: join(dir, "wb.xlsx"), cwd: dir },
        { fs },
      ),
    ).rejects.toMatchObject({ code: "SOURCE_INVALID" });
  });
});
