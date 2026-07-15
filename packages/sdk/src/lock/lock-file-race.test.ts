import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildWorkbook, readWorkbook } from "@verbatra/exchange";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { retranslateEntry } from "../flow/retranslate-entry.js";
import { translate } from "../flow/translate-project.js";
import { exportWorkbook } from "../flow/workbook/export-workbook.js";
import { importWorkbook } from "../flow/workbook/import-workbook.js";
import { type BoundedFileRead, defaultFs, type SdkFs } from "../fs.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../test-support.js";
import { lockFilePath } from "./lock-file.js";

/**
 * Wraps a real {@link SdkFs}, running `inject` immediately before the `n`th read of `lockPath`
 * (1-indexed), then letting that read proceed against whatever `inject` itself left on disk. Used
 * to force a concrete, deterministic interleaving between two writers racing the lock file's
 * read-modify-write step: `inject` plays the role of a second writer that completes in full between
 * this writer's own freshness-check reads.
 */
function raceBeforeNthLockRead(
  base: SdkFs,
  lockPath: string,
  n: number,
  inject: () => Promise<void>,
): SdkFs {
  let count = 0;
  return {
    ...base,
    readFileBounded: async (path: string, maxBytes: number): Promise<BoundedFileRead> => {
      if (path === lockPath) {
        count += 1;
        if (count === n) {
          await inject();
        }
      }
      return base.readFileBounded(path, maxBytes);
    },
  };
}

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de", "fr"], format: "i18next-json", ...overrides });

async function project(source: Record<string, unknown>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  await writeJsonFile(join(dir, "locales", "en.json"), source);
  return dir;
}

async function lockLocales(dir: string): Promise<Record<string, Record<string, string>>> {
  const lock = (await readJsonFile(join(dir, "verbatra.lock.json"))) as {
    locales: Record<string, Record<string, string>>;
  };
  return lock.locales;
}

describe("lock-file write race: retranslateEntry versus a concurrent CLI translate run", () => {
  it("neither writer's lock update is discarded when both land around the same read-modify-write window (criterion 12, test 1)", async () => {
    // A same-locale race is naturally self-healing here: translate()'s own per-locale lock write
    // recomputes every source-present key's hash from the source alone (see computeLockEntries),
    // so it would independently reconstruct the same value retranslateEntry writes for a stable
    // source key regardless of write ordering. The write-race protection is instead exercised, and
    // only exercised, across two locales: translate() writing "fr" must not blindly overwrite the
    // whole lock file (as the pre-refactor blind read-once-write-many loop did) and silently drop a
    // concurrent retranslateEntry write to "de".
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const lockPath = lockFilePath(dir);
    const stub = makeStubProvider();

    const raceFs = raceBeforeNthLockRead(defaultFs, lockPath, 3, async () => {
      // Plays the concurrent writer: completes an entire retranslateEntry call against a different
      // locale in between translate()'s own before/after freshness-check reads for "fr".
      const result = await retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
        { createProvider: () => stub.provider },
      );
      expect(result.accepted).toBe(true);
    });

    const summary = await translate(
      { config: cfg({ targetLocales: ["fr"] }), cwd: dir },
      { createProvider: () => stub.provider, fs: raceFs },
    );

    expect(summary.failed).toEqual([]);
    const locales = await lockLocales(dir);
    expect(locales.fr?.greeting).toBeDefined(); // translate()'s own write survived
    expect(locales.fr?.farewell).toBeDefined();
    expect(locales.de?.greeting).toBeDefined(); // retranslateEntry's concurrent write to "de" survived
  });
});

describe("lock-file write race: retranslateEntry versus a concurrent Excel import", () => {
  it("neither writer's lock update is discarded (criterion 12, test 1, workbook import)", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const lockPath = lockFilePath(dir);
    const stub = makeStubProvider();

    const out = await exportWorkbook({ config: cfg({ targetLocales: ["fr"] }), cwd: dir });
    const data = await readWorkbook(new Uint8Array(await readFile(out.path)));
    const filled = data.sheets.map((sheet) => ({
      locale: sheet.locale,
      rows: sheet.rows.map((row) => ({
        ...row,
        translation: `${row.translation || row.source} FR`,
      })),
    }));
    await writeFile(out.path, await buildWorkbook({ sheets: filled }));

    const raceFs = raceBeforeNthLockRead(defaultFs, lockPath, 3, async () => {
      const result = await retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
        { createProvider: () => stub.provider },
      );
      expect(result.accepted).toBe(true);
    });

    const summary = await importWorkbook(
      { config: cfg({ targetLocales: ["fr"] }), workbook: out.path, cwd: dir },
      { fs: raceFs },
    );

    expect(summary.failed).toEqual([]);
    const locales = await lockLocales(dir);
    expect(locales.fr?.greeting).toBeDefined();
    expect(locales.de?.greeting).toBeDefined(); // survives the concurrent import to a different locale
  });
});

describe("lock-file write race: two concurrent retranslateEntry calls", () => {
  it("both keys' lock entries survive when they race on the same locale (criterion 12, test 2)", async () => {
    const dir = await project({ greeting: "Hello", farewell: "Goodbye" });
    const lockPath = lockFilePath(dir);
    const stub = makeStubProvider();

    // Call A's own attempt reads the lock twice (before, after). Inject call B's full completion
    // between them, forcing call A to detect the conflict, retry, and merge its own key onto call
    // B's already-written state.
    const raceFs = raceBeforeNthLockRead(defaultFs, lockPath, 2, async () => {
      const resultB = await retranslateEntry(
        { config: cfg(), cwd: dir, locale: "de", key: "farewell" },
        { createProvider: () => stub.provider },
      );
      expect(resultB.accepted).toBe(true);
    });

    const resultA = await retranslateEntry(
      { config: cfg(), cwd: dir, locale: "de", key: "greeting" },
      { createProvider: () => stub.provider, fs: raceFs },
    );

    expect(resultA.accepted).toBe(true);
    const locales = await lockLocales(dir);
    expect(locales.de?.greeting).toBeDefined();
    expect(locales.de?.farewell).toBeDefined();
  });
});
