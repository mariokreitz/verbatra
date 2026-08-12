import { join, resolve } from "node:path";
import { computeReviewFlags, type ReviewFlag } from "@verbatra/ai-providers";
import { checkPlaceholders, contentHash, diffResources, type LocaleResource } from "@verbatra/core";
import {
  buildDelimited,
  buildWorkbook,
  type DelimitedFormat,
  delimitedFileName,
  type ReviewStatus,
  type WorkbookModel,
  type WorkbookRow,
  type WorkbookSheet,
} from "@verbatra/exchange";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../../config/schema.js";
import { defaultFs, type SdkFs } from "../../fs.js";
import { createLocalePathResolver } from "../../locale-path/resolver.js";
import { baselineFor, lockFilePath, readLockFile } from "../../lock/lock-file.js";
import { selectAdapter } from "../../selection/select-adapter.js";
import { readTargetResource } from "../read-target.js";
import { selectLocales } from "../select-locales.js";
import { readSourceResource } from "../source.js";
import { type ExchangeFormat, isDelimitedFormat } from "./exchange-format.js";
import { writeExportManifest } from "./export-manifest.js";

/** Default workbook output path, relative to the resolved working directory. */
export const DEFAULT_WORKBOOK_PATH = "verbatra-translations.xlsx";

/**
 * Default delimited output directory, relative to the resolved working directory. A delimited export
 * writes one file per target locale, so its output path names a directory, not a file.
 */
export const DEFAULT_DELIMITED_PATH = "verbatra-translations";

/** Input for {@link exportWorkbook}: the validated config and where/how to run the export. */
export interface ExportWorkbookInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern, lock-file, and output path resolve against; defaults to cwd. */
  readonly cwd?: string;
  /**
   * Output path; defaults to {@link DEFAULT_WORKBOOK_PATH} for `xlsx` and to
   * {@link DEFAULT_DELIMITED_PATH} for `csv` and `tsv`. It is the workbook file for `xlsx` and the
   * directory the per-locale files are written into for `csv` and `tsv` (created if missing).
   */
  readonly out?: string;
  /** Subset of target locales to export; defaults to all configured target locales. */
  readonly locales?: readonly string[];
  /** Include unchanged keys (off by default; export is missing-and-changed only). */
  readonly includeUnchanged?: boolean;
  /** Interchange format to write; defaults to `xlsx`, so an existing caller is unaffected. */
  readonly format?: ExchangeFormat;
}

/** Composition seam for {@link exportWorkbook}: inject a registry and a file system for tests. */
export interface ExportWorkbookDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/** The outcome of an export: where it was written and how many rows per locale. */
export interface ExportWorkbookResult {
  /**
   * The absolute path written to: the workbook file for `xlsx`, the directory holding one
   * `<locale>.csv` or `<locale>.tsv` per exported locale for the delimited formats.
   */
  readonly path: string;
  /** Per-locale row counts, in config order; the same set the workbook carries. */
  readonly locales: readonly { readonly locale: string; readonly rows: number }[];
}

/** A reason code's lowercase-hyphenated label, e.g. "LENGTH_RATIO_OUTLIER" -> "length-ratio-outlier". */
function reasonLabel(reason: string): string {
  return reason.toLowerCase().replace(/_/g, "-");
}

/** Convert a recomputed {@link ReviewFlag} to the workbook row's plain-string review columns. */
function reviewColumns(flag: ReviewFlag | undefined): {
  reviewStatus: ReviewStatus;
  reviewReasons: string;
} {
  if (flag === undefined) {
    return { reviewStatus: "ok", reviewReasons: "" };
  }
  return { reviewStatus: "review", reviewReasons: flag.reasons.map(reasonLabel).join(", ") };
}

/**
 * Recompute a row's review flags from on-disk source/current-target values, exactly like the
 * translate-time heuristic, but never applying PROVIDER_DEGRADED: no provider call happens during
 * export, so that fact does not exist here (see the manual-translation review-flags design).
 */
function computeRowReview(
  adapter: FormatAdapter,
  sourceValue: string,
  currentTarget: string,
  sourceLocale: string,
  targetLocale: string,
  glossary: Readonly<Record<string, string>> | undefined,
): { reviewStatus: ReviewStatus; reviewReasons: string } {
  if (currentTarget === "") {
    return { reviewStatus: "ok", reviewReasons: "" };
  }
  const integrity =
    adapter.comparePlaceholders?.(sourceValue, currentTarget) ??
    checkPlaceholders(
      adapter.extractPlaceholders(sourceValue),
      adapter.extractPlaceholders(currentTarget),
    );
  const flag = computeReviewFlags({
    sourceValue,
    translatedValue: currentTarget,
    sourceLocale,
    targetLocale,
    integrity,
    glossary,
  });
  return reviewColumns(flag);
}

/**
 * Build one locale sheet's rows: missing and changed keys from the lock-baseline diff, plus
 * unchanged keys on opt-in. Rows are re-sorted by key across the status buckets so the whole sheet
 * has a deterministic total order.
 */
function buildRows(
  source: LocaleResource,
  target: LocaleResource,
  baseline: ReadonlyMap<string, string>,
  includeUnchanged: boolean,
  adapter: FormatAdapter,
  glossary: Readonly<Record<string, string>> | undefined,
): readonly WorkbookRow[] {
  const diff = diffResources(source, target, { baseline });
  const rows: WorkbookRow[] = [];
  const add = (keys: readonly string[], status: "new" | "changed" | "unchanged"): void => {
    for (const key of keys) {
      const sourceEntry = source.entries.get(key);
      if (sourceEntry === undefined) {
        continue;
      }
      const currentTarget = target.entries.get(key)?.value ?? "";
      rows.push({
        key,
        source: sourceEntry.value,
        currentTarget,
        status,
        sourceHash: contentHash(sourceEntry),
        translation: "",
        context: sourceEntry.description ?? "",
        ...computeRowReview(
          adapter,
          sourceEntry.value,
          currentTarget,
          source.locale,
          target.locale,
          glossary,
        ),
      });
    }
  };
  add(diff.missing, "new");
  add(diff.changed, "changed");
  if (includeUnchanged) {
    add(diff.unchanged, "unchanged");
  }
  return [...rows].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * Write one delimited interchange file per exported locale into the output directory, creating the
 * directory (and any missing parent) first. The file name carries the locale, since a delimited file
 * has no sheet to name it.
 *
 * Nothing already in the directory is removed: a file the user put there, and a locale file from an
 * earlier export with a wider selection, both survive untouched. What the run does instead is record
 * the locales it wrote, in the manifest written last (see {@link writeExportManifest}), so a later
 * import can tell this export's files from an earlier one's leftovers and refuse to apply the latter.
 */
async function writeDelimitedFiles(
  fs: SdkFs,
  directory: string,
  format: DelimitedFormat,
  sheets: readonly WorkbookSheet[],
): Promise<void> {
  await fs.mkdir?.(directory);
  for (const sheet of sheets) {
    await fs.writeFile(
      join(directory, delimitedFileName(sheet.locale, format)),
      buildDelimited(sheet, format),
    );
  }
  await writeExportManifest(
    fs,
    directory,
    format,
    sheets.map((sheet) => sheet.locale),
  );
}

/**
 * Export the strings needing human translation into a styled `.xlsx` workbook, or into one plain
 * `.csv` or `.tsv` file per target locale. Each target locale is diffed against the source and lock
 * baseline to pick the rows (missing and changed by default; add unchanged with `includeUnchanged`),
 * and the result is written to `out`. No provider is called and no lock-file is written.
 *
 * The delimited formats trade the workbook's protection for a diffable, git-friendly handoff: a
 * workbook leaves only the Translation column editable and hides the source hash, while every field of
 * a delimited file is editable and its source hash is visible. An edited source hash is never trusted
 * on import; it is compared against the live source and the row is withheld as drift.
 *
 * A delimited export also writes a small hidden manifest naming the locales it wrote. It exists so a
 * re-export with a narrower `locales` selection retires the locales it dropped: their files stay on
 * disk, but the next import recognizes them as leftovers from the earlier run and refuses to apply
 * them. The export deletes nothing, so an unrelated file in the output directory is never at risk.
 *
 * @param input - The validated config and export options.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns Where the export was written and the per-locale row counts.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`, `LOCK_FILE_INVALID`
 *   with the same meanings as in `translate`, or `UNKNOWN_LOCALE` when a requested locale is not
 *   among the configured target locales.
 * @example
 * ```ts
 * import { loadConfig, exportWorkbook } from "@verbatra/sdk";
 *
 * const config = await loadConfig();
 * const result = await exportWorkbook({ config, out: "handoff.xlsx" });
 *
 * console.log(`wrote ${result.path}`);
 * for (const locale of result.locales) {
 *   console.log(`${locale.locale}: ${locale.rows} rows to translate`);
 * }
 * ```
 */
export async function exportWorkbook(
  input: ExportWorkbookInput,
  deps: ExportWorkbookDeps = {},
): Promise<ExportWorkbookResult> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);
  const resolver = createLocalePathResolver(cwd, config);

  const source = await readSourceResource(config, resolver, fs, adapter);
  const lock = await readLockFile(lockFilePath(cwd), fs);

  const locales = selectLocales(config, input.locales);
  const sheets = await Promise.all(
    locales.map(async (locale) => {
      const target = await readTargetResource({
        resolver,
        format: config.format,
        locale,
        adapter,
        fs,
      });
      const rows = buildRows(
        source.resource,
        target,
        baselineFor(lock, locale),
        input.includeUnchanged ?? false,
        adapter,
        config.glossary,
      );
      return { locale, rows };
    }),
  );

  const format = input.format ?? "xlsx";
  const path = resolve(
    cwd,
    input.out ?? (isDelimitedFormat(format) ? DEFAULT_DELIMITED_PATH : DEFAULT_WORKBOOK_PATH),
  );
  if (isDelimitedFormat(format)) {
    await writeDelimitedFiles(fs, path, format, sheets);
  } else {
    const model: WorkbookModel = { sheets };
    await fs.writeBytes(path, await buildWorkbook(model));
  }

  return {
    path,
    locales: sheets.map((sheet) => ({ locale: sheet.locale, rows: sheet.rows.length })),
  };
}
