import { resolve } from "node:path";
import { contentHash, diffResources, type LocaleResource } from "@verbatra/core";
import { buildWorkbook, type WorkbookModel, type WorkbookRow } from "@verbatra/exchange";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../../config/schema.js";
import { defaultFs, type SdkFs } from "../../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../../lock/lock-file.js";
import { localeFilePath } from "../../paths.js";
import { selectAdapter } from "../../selection/select-adapter.js";
import { readSource } from "../source.js";

/** Default workbook output path, relative to the resolved working directory. */
export const DEFAULT_WORKBOOK_PATH = "verbatra-translations.xlsx";

/** Input for {@link exportWorkbook}: the validated config and where/how to run the export. */
export interface ExportWorkbookInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern, lock-file, and output path resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Output path for the workbook; defaults to {@link DEFAULT_WORKBOOK_PATH} under cwd. */
  readonly out?: string;
  /** Subset of target locales to export; defaults to all configured target locales. */
  readonly locales?: readonly string[];
  /** Include unchanged keys (off by default; export is missing-and-changed only). */
  readonly includeUnchanged?: boolean;
}

/** Composition seam for {@link exportWorkbook}: inject a registry and a file system for tests. */
export interface ExportWorkbookDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/** The outcome of an export: where it was written and how many rows per locale. */
export interface ExportWorkbookResult {
  /** The absolute path the workbook was written to. */
  readonly path: string;
  /** Per-locale row counts, in config order; the same set the workbook carries. */
  readonly locales: readonly { readonly locale: string; readonly rows: number }[];
}

/** Read a locale's existing target resource, or an empty resource when the file does not exist. */
async function readTarget(
  cwd: string,
  config: VerbatraConfig,
  adapter: FormatAdapter,
  fs: SdkFs,
  locale: string,
): Promise<LocaleResource> {
  const path = localeFilePath(cwd, config.files.pattern, locale);
  if (!(await fs.fileExists(path))) {
    return { locale, namespace: "", format: config.format, entries: new Map() };
  }
  return (await adapter.read(path, locale)).resource;
}

/**
 * Build one locale's rows from the diff: missing keys as "new" and changed keys as "changed" (plus
 * unchanged keys when requested), each carrying the source value, current target, and the export-time
 * source hash, with an empty translation. Rows are returned in a single stable total order by key.
 */
function buildRows(
  source: LocaleResource,
  target: LocaleResource,
  baseline: ReadonlyMap<string, string>,
  includeUnchanged: boolean,
): readonly WorkbookRow[] {
  const diff = diffResources(source, target, { baseline });
  const rows: WorkbookRow[] = [];
  const add = (keys: readonly string[], status: "new" | "changed"): void => {
    for (const key of keys) {
      const sourceEntry = source.entries.get(key);
      if (sourceEntry === undefined) {
        continue;
      }
      rows.push({
        key,
        source: sourceEntry.value,
        currentTarget: target.entries.get(key)?.value ?? "",
        status,
        sourceHash: contentHash(sourceEntry),
        translation: "",
      });
    }
  };
  add(diff.missing, "new");
  add(diff.changed, "changed");
  if (includeUnchanged) {
    add(diff.unchanged, "changed");
  }
  // Keys arrive already sorted within each bucket from diffResources; re-sort the whole sheet by
  // key so the row order is a single stable total order (deterministic re-export).
  return [...rows].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Resolve which target locales to export: all configured ones, or the requested subset in config order. */
function selectedLocales(config: VerbatraConfig, requested?: readonly string[]): readonly string[] {
  if (requested === undefined) {
    return config.targetLocales;
  }
  const wanted = new Set(requested);
  // Preserve config order; silently ignore a requested locale that is not configured.
  return config.targetLocales.filter((locale) => wanted.has(locale));
}

/**
 * Export the strings needing human translation into a styled `.xlsx` workbook. Reuses the same
 * source read, adapter selection, and lock baseline the translate flow uses, runs `diffResources`
 * per target locale to pick the rows (missing and changed by default; add unchanged with
 * `includeUnchanged`), hands the neutral row model to `@verbatra/exchange`'s `buildWorkbook`, and
 * writes the bytes through the {@link SdkFs} seam. No provider is called and no lock-file is written.
 *
 * @param input - The validated config and export options.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns Where the workbook was written and the per-locale row counts.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`, `LOCK_FILE_INVALID`
 *   with the same meanings as in `translate`.
 */
export async function exportWorkbook(
  input: ExportWorkbookInput,
  deps: ExportWorkbookDeps = {},
): Promise<ExportWorkbookResult> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);

  const source = await readSource(config, cwd, fs, adapter);
  const lock = await readLockFile(lockFilePath(cwd), fs);

  const locales = selectedLocales(config, input.locales);
  const sheets = await Promise.all(
    locales.map(async (locale) => {
      const target = await readTarget(cwd, config, adapter, fs, locale);
      const rows = buildRows(
        source.resource,
        target,
        baselineFor(lock, locale),
        input.includeUnchanged ?? false,
      );
      return { locale, rows };
    }),
  );

  const model: WorkbookModel = { sheets };
  const bytes = await buildWorkbook(model);
  // The workbook output is a plain (non-locale) path: resolve it directly against cwd.
  const path = resolve(cwd, input.out ?? DEFAULT_WORKBOOK_PATH);
  await fs.writeBytes(path, bytes);

  return {
    path,
    locales: sheets.map((sheet) => ({ locale: sheet.locale, rows: sheet.rows.length })),
  };
}
