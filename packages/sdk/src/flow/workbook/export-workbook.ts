import { resolve } from "node:path";
import { computeReviewFlags, type ReviewFlag } from "@verbatra/ai-providers";
import { checkPlaceholders, contentHash, diffResources, type LocaleResource } from "@verbatra/core";
import {
  buildWorkbook,
  type ReviewStatus,
  type WorkbookModel,
  type WorkbookRow,
} from "@verbatra/exchange";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../../config/schema.js";
import { defaultFs, type SdkFs } from "../../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../../lock/lock-file.js";
import { localeFilePath } from "../../paths.js";
import { selectAdapter } from "../../selection/select-adapter.js";
import { selectLocales } from "../select-locales.js";
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
 * Export the strings needing human translation into a styled `.xlsx` workbook. Each target locale is
 * diffed against the source and lock baseline to pick the rows (missing and changed by default; add
 * unchanged with `includeUnchanged`), and the bytes are written to `out`. No provider is called and no
 * lock-file is written.
 *
 * @param input - The validated config and export options.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns Where the workbook was written and the per-locale row counts.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`, `LOCK_FILE_INVALID`
 *   with the same meanings as in `translate`, or `UNKNOWN_LOCALE` when a requested locale is not
 *   among the configured target locales.
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

  const locales = selectLocales(config, input.locales);
  const sheets = await Promise.all(
    locales.map(async (locale) => {
      const target = await readTarget(cwd, config, adapter, fs, locale);
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

  const model: WorkbookModel = { sheets };
  const bytes = await buildWorkbook(model);
  const path = resolve(cwd, input.out ?? DEFAULT_WORKBOOK_PATH);
  await fs.writeBytes(path, bytes);

  return {
    path,
    locales: sheets.map((sheet) => ({ locale: sheet.locale, rows: sheet.rows.length })),
  };
}
