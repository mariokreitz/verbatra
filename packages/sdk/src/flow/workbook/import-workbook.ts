import { basename, join, resolve } from "node:path";
import { contentHash, type LocaleResource, type TranslationEntry } from "@verbatra/core";
import {
  type DelimitedFormat,
  delimitedFileName,
  readDelimited,
  readWorkbook,
  type WorkbookData,
  type WorkbookDuplicateKey,
  type WorkbookRowProblem,
  type WorkbookSheet,
} from "@verbatra/exchange";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import { computeFingerprint } from "../../cache/fingerprint.js";
import { feedTranslationMemory } from "../../cache/translation-memory.js";
import type { VerbatraConfig } from "../../config/schema.js";
import { errorMessage, SdkError } from "../../errors.js";
import { defaultFs, type SdkFs } from "../../fs.js";
import { withLocaleWriteLock } from "../../lock/locale-write-lock.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockFileLocale,
} from "../../lock/lock-file.js";
import type { LockFile } from "../../lock/types.js";
import { localeFilePath } from "../../paths.js";
import { selectAdapter } from "../../selection/select-adapter.js";
import { readTarget } from "../diff-locales.js";
import { failureSummary, partition } from "../locale-failure.js";
import { readSource } from "../source.js";
import type { LocaleSummary, RunSummary } from "../summary.js";
import { type ExchangeFormat, isDelimitedFormat } from "./exchange-format.js";
import { type ImportLocaleResult, importLocale } from "./import-locale.js";

/** On-disk size cap enforced before the untrusted workbook bytes reach `@verbatra/exchange`. */
const MAX_WORKBOOK_FILE_BYTES = 64 * 1024 * 1024;

/** On-disk size cap enforced before one untrusted interchange file's text reaches `@verbatra/exchange`. */
const MAX_DELIMITED_FILE_BYTES = 32 * 1024 * 1024;

/** Input for {@link importWorkbook}: the validated config, the workbook path, and run options. */
export interface ImportWorkbookInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /**
   * Path to the filled handoff to import: the workbook file for `xlsx`, and for `csv` and `tsv`
   * either one `<locale>.csv` / `<locale>.tsv` file or a directory holding one per target locale.
   */
  readonly workbook: string;
  /** Directory the file pattern, lock-file, and workbook path resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** When true, validate and report only: write no locale file and update no lock-file. */
  readonly dryRun?: boolean;
  /** Interchange format to read; defaults to `xlsx`, so an existing caller is unaffected. */
  readonly format?: ExchangeFormat;
}

/** Composition seam for {@link importWorkbook}: inject a registry and a file system for tests. */
export interface ImportWorkbookDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

async function readWorkbookBytes(path: string, fs: SdkFs): Promise<Uint8Array> {
  const read = await fs.readBytesBounded(path, MAX_WORKBOOK_FILE_BYTES);
  if (read.kind === "missing") {
    throw new SdkError("SOURCE_UNREADABLE", `The workbook was not found at ${path}.`);
  }
  if (read.kind === "too-large") {
    throw new SdkError(
      "SOURCE_INVALID",
      `The workbook at ${path} exceeds the maximum allowed size of ${MAX_WORKBOOK_FILE_BYTES} bytes.`,
    );
  }
  return read.bytes;
}

/** One interchange file's text and the locale its file name named. */
interface DelimitedSource {
  readonly locale: string;
  readonly text: string;
}

/** Read one interchange file, bounded; `undefined` when nothing readable is at the path. */
async function readDelimitedText(path: string, fs: SdkFs): Promise<string | undefined> {
  const read = await fs.readFileBounded(path, MAX_DELIMITED_FILE_BYTES);
  if (read.kind === "missing") {
    return undefined;
  }
  if (read.kind === "too-large") {
    throw new SdkError(
      "SOURCE_INVALID",
      `The interchange file at ${path} exceeds the maximum allowed size of ${MAX_DELIMITED_FILE_BYTES} bytes.`,
    );
  }
  return read.content;
}

/**
 * Resolve the interchange files an import reads. The path is read as a single file first; when nothing
 * readable is there it is treated as a directory and probed for one `<locale>.<format>` file per
 * configured target locale, which is exactly the layout the export writes. A configured locale with no
 * file is not an error here: it is reconciled with every other absent locale after the sheet loop.
 *
 * @throws {@link SdkError} `SOURCE_UNREADABLE` when the path is neither a readable file nor a
 *   directory holding an interchange file for any configured target locale
 */
async function collectDelimitedSources(
  path: string,
  config: VerbatraConfig,
  fs: SdkFs,
  format: DelimitedFormat,
): Promise<readonly DelimitedSource[]> {
  const single = await readDelimitedText(path, fs);
  if (single !== undefined) {
    return [{ locale: basename(path, `.${format}`), text: single }];
  }
  const sources: DelimitedSource[] = [];
  for (const locale of config.targetLocales) {
    const text = await readDelimitedText(join(path, delimitedFileName(locale, format)), fs);
    if (text !== undefined) {
      sources.push({ locale, text });
    }
  }
  if (sources.length === 0) {
    throw new SdkError(
      "SOURCE_UNREADABLE",
      `No ${format} file was found at ${path}, and it holds no <locale>.${format} file for any configured target locale.`,
    );
  }
  return sources;
}

/**
 * Parse every interchange file into the one {@link WorkbookData} the sheet loop consumes, so a
 * delimited handoff is judged through exactly the path a workbook is judged through.
 */
function parseDelimitedSources(
  sources: readonly DelimitedSource[],
  format: DelimitedFormat,
): WorkbookData {
  const sheets: WorkbookSheet[] = [];
  const malformedRows: WorkbookRowProblem[] = [];
  const duplicateKeys: WorkbookDuplicateKey[] = [];
  for (const source of sources) {
    const data = readDelimited({ text: source.text, locale: source.locale, format });
    sheets.push(...data.sheets);
    malformedRows.push(...data.malformedRows);
    duplicateKeys.push(...data.duplicateKeys);
  }
  return { sheets, malformedRows, duplicateKeys };
}

/**
 * Read the filled handoff at the path into the neutral row model, whichever format it is in. An
 * `SdkError` (a missing, oversized, or unresolvable path) is rethrown as it is; any structural failure
 * from the exchange reader becomes a structured `SOURCE_INVALID` carrying no file content.
 *
 * @throws {@link SdkError} `SOURCE_UNREADABLE` or `SOURCE_INVALID`
 */
async function readImportData(
  path: string,
  config: VerbatraConfig,
  fs: SdkFs,
  format: ExchangeFormat,
): Promise<WorkbookData> {
  try {
    if (isDelimitedFormat(format)) {
      return parseDelimitedSources(await collectDelimitedSources(path, config, fs, format), format);
    }
    return await readWorkbook(await readWorkbookBytes(path, fs));
  } catch (error) {
    if (error instanceof SdkError) {
      throw error;
    }
    throw new SdkError("SOURCE_INVALID", errorMessage(error));
  }
}

function mergeAccepted(
  target: LocaleResource,
  accepted: ImportLocaleResult["accepted"],
): Map<string, TranslationEntry> {
  const merged = new Map(target.entries);
  for (const [key, { value, source }] of accepted) {
    merged.set(key, { ...source, value, namespace: target.namespace });
  }
  return merged;
}

/**
 * The accepted values as a source-content-hash to value record, this sheet's contribution to the
 * cache.
 *
 * A `[[CLEAR]]`ed key is excluded. The cache is keyed by source content, so anything stored here is
 * later served to every key whose source text is byte-identical; `[[CLEAR]]` is an intent about one
 * key rather than a translation of its text, so storing it would hand an empty value to unrelated
 * keys that merely share the source string, with no provider call to notice it.
 */
function sheetCacheAdditions(accepted: ImportLocaleResult["accepted"]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [, { value, source, cleared }] of accepted) {
    if (!cleared) {
      record[contentHash(source)] = value;
    }
  }
  return record;
}

/** Fold one sheet's additions into the run's per-locale map, merging when two sheets share a locale. */
function collectSheetAdditions(
  byLocale: Map<string, Record<string, string>>,
  locale: string,
  additions: Record<string, string>,
): void {
  if (Object.keys(additions).length === 0) {
    return;
  }
  byLocale.set(locale, { ...byLocale.get(locale), ...additions });
}

/**
 * Only a key actually accepted this run advances its lock baseline to the current source hash. Every
 * other source-present key (withheld for drift, placeholder, or ICU; or a row the translator left
 * blank) keeps its prior baseline hash so it keeps re-exporting until it is genuinely resolved: a
 * blank cell must never silently hide a source change by advancing the baseline past it. A key with
 * no prior baseline at all falls back to the current hash, matching first-run bootstrap.
 */
function computeLockEntries(
  source: LocaleResource,
  merged: ReadonlyMap<string, TranslationEntry>,
  baseline: ReadonlyMap<string, string>,
  accepted: ImportLocaleResult["accepted"],
): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const key of merged.keys()) {
    const sourceEntry = source.entries.get(key);
    if (sourceEntry === undefined) {
      continue;
    }
    if (accepted.has(key)) {
      entries[key] = contentHash(sourceEntry);
      continue;
    }
    const prior = baseline.get(key);
    entries[key] = prior !== undefined ? prior : contentHash(sourceEntry);
  }
  return entries;
}

interface SheetContext {
  readonly config: VerbatraConfig;
  readonly cwd: string;
  readonly adapter: FormatAdapter;
  readonly fs: SdkFs;
  readonly source: LocaleResource;
  readonly sourceInvalidIcuKeys: readonly string[];
  readonly dryRun: boolean;
  /** Every malformed row the reader reported, across all sheets; filtered to the running locale. */
  readonly malformedRows: WorkbookData["malformedRows"];
  /** Every duplicate-key occurrence the reader reported; filtered to the running locale. */
  readonly duplicateKeys: WorkbookData["duplicateKeys"];
  /** The format the handoff was read in, so a locale-mapping failure is worded for that format. */
  readonly format: ExchangeFormat;
}

/**
 * A configured target locale carried by no part of the returned handoff (a deleted or renamed workbook
 * tab, a missing or renamed interchange file) that would otherwise be a silent drop. Surfaced as that
 * locale's structured failure. The code stays the same across formats; only the wording differs.
 */
class MissingSheetError extends Error {
  readonly code = "WORKBOOK_SHEET_MISSING";
  constructor(locale: string, format: ExchangeFormat) {
    super(
      isDelimitedFormat(format)
        ? `The handoff has no "${delimitedFileName(locale, format)}" file for the configured target locale "${locale}". ` +
            "The file may have been renamed, deleted, or left out of the directory."
        : `The workbook has no sheet (tab) for the configured target locale "${locale}". ` +
            "The tab may have been renamed, deleted, or reordered out of the workbook.",
    );
    this.name = "MissingSheetError";
  }
}

/**
 * Run one data sheet: judge its rows with {@link importLocale}, and on a non-dry-run write the merged
 * target file when anything was accepted. The file write is skipped when nothing was accepted, but the
 * lock entries are still recomputed so the locale's existing baseline is never wiped just because this
 * run wrote nothing. Throws `CONFIG_INVALID` for a sheet whose locale is not a configured target.
 */
async function runSheet(
  ctx: SheetContext,
  sheet: WorkbookSheet,
  lock: LockFile,
): Promise<{
  summary: LocaleSummary;
  lockEntries: Record<string, string>;
  cacheAdditions: Record<string, string>;
}> {
  if (!ctx.config.targetLocales.includes(sheet.locale)) {
    throw new SdkError(
      "CONFIG_INVALID",
      isDelimitedFormat(ctx.format)
        ? `The handoff has a file named "${sheet.locale}.${ctx.format}", whose locale is not a configured target locale. ` +
            "Name every interchange file exactly as it was exported."
        : `The workbook has a sheet named "${sheet.locale}", which is not a configured target locale. ` +
            "It may be a renamed, added, or reordered tab; leave every language tab named exactly as exported.",
    );
  }
  const target = await readTarget(ctx.cwd, ctx.config, ctx.adapter, ctx.fs, sheet.locale);
  const baseline = baselineFor(lock, sheet.locale);
  const { summary, accepted } = importLocale({
    sheet,
    source: ctx.source,
    target,
    baseline,
    adapter: ctx.adapter,
    sourceInvalidIcuKeys: ctx.sourceInvalidIcuKeys,
    malformedRows: ctx.malformedRows
      .filter((problem) => problem.locale === sheet.locale)
      .map((problem) => ({ row: problem.row, column: problem.column })),
    duplicateKeys: ctx.duplicateKeys
      .filter((duplicate) => duplicate.locale === sheet.locale)
      .map((duplicate) => ({ key: duplicate.key, row: duplicate.row })),
  });

  if (ctx.dryRun) {
    return { summary, lockEntries: {}, cacheAdditions: {} };
  }

  const merged = mergeAccepted(target, accepted);
  if (accepted.size > 0) {
    const path = localeFilePath(ctx.cwd, ctx.config.files.pattern, sheet.locale);
    await ctx.adapter.write(
      {
        locale: sheet.locale,
        namespace: target.namespace,
        format: ctx.config.format,
        entries: merged,
      },
      path,
    );
  }
  return {
    summary,
    lockEntries: computeLockEntries(ctx.source, merged, baseline, accepted),
    cacheAdditions: sheetCacheAdditions(accepted),
  };
}

/**
 * Import a filled handoff back into the locale files. Each target-locale data sheet runs the same
 * source-drift, placeholder, and ICU checks as the translate flow, the accepted values are written
 * through the format adapter, and the lock is updated. Returns a {@link RunSummary} structurally
 * identical to `translate`'s.
 *
 * Whole-run failures (unknown format, unreadable/invalid/oversized workbook, corrupt lock) throw a
 * structured {@link SdkError}. A per-sheet failure (a sheet named for a locale not in config, a
 * broken-round-trip key, a write failure) is isolated as that locale's `status: "failed"`, not a
 * throw; per-row rejections are withheld and reported on the locale. A configured target locale with
 * no sheet at all (a deleted, renamed, or reordered tab) is reconciled after the sheet loop and
 * reported as that locale's `status: "failed"` (`WORKBOOK_SHEET_MISSING`) rather than silently
 * dropped. Dry-run validates and reports without writing any locale or lock file, and skips lock
 * acquisition (there is nothing to protect).
 *
 * The lock-file is read once, up front, for every sheet's diff baseline. On a non-dry-run, each
 * sheet's write-and-lock-update step then holds that locale's `withLocaleWriteLock` for its whole
 * critical section, so a concurrent writer touching the same locale can never interleave with it.
 *
 * @param input - The validated config, the workbook path, and run options.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns A {@link RunSummary} with one locale per data sheet, in workbook order.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`, `LOCK_FILE_INVALID`.
 */
export async function importWorkbook(
  input: ImportWorkbookInput,
  deps: ImportWorkbookDeps = {},
): Promise<RunSummary> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const dryRun = input.dryRun ?? false;
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);

  const source = await readSource(config, cwd, fs, adapter);
  const format = input.format ?? "xlsx";
  const data = await readImportData(resolve(cwd, input.workbook), config, fs, format);

  const lock = await readLockFile(lockFilePath(cwd), fs);

  const ctx: SheetContext = {
    config,
    cwd,
    adapter,
    fs,
    source: source.resource,
    sourceInvalidIcuKeys: source.invalidIcuKeys,
    dryRun,
    malformedRows: data.malformedRows,
    duplicateKeys: data.duplicateKeys,
    format,
  };

  const summaries: LocaleSummary[] = [];
  const cacheAdditions = new Map<string, Record<string, string>>();
  for (const sheet of data.sheets) {
    try {
      let summary: LocaleSummary;
      if (dryRun) {
        summary = (await runSheet(ctx, sheet, lock)).summary;
      } else {
        summary = await withLocaleWriteLock(cwd, sheet.locale, fs, async () => {
          const result = await runSheet(ctx, sheet, lock);
          await updateLockFileLocale(cwd, fs, sheet.locale, {
            mode: "replace",
            entries: result.lockEntries,
          });
          collectSheetAdditions(cacheAdditions, sheet.locale, result.cacheAdditions);
          return result.summary;
        });
      }
      summaries.push(summary);
    } catch (error) {
      summaries.push(failureSummary(sheet.locale, error));
    }
  }

  const presentLocales = new Set(data.sheets.map((sheet) => sheet.locale));
  for (const locale of config.targetLocales) {
    if (!presentLocales.has(locale)) {
      summaries.push(failureSummary(locale, new MissingSheetError(locale, format)));
    }
  }

  if (!dryRun) {
    await feedTranslationMemory(cwd, fs, computeFingerprint(config), cacheAdditions);
  }

  const { succeeded, partial, failed } = partition(summaries);
  return { dryRun, locales: summaries, succeeded, partial, failed };
}
