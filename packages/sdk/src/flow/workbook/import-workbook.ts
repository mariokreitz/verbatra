import { resolve } from "node:path";
import { contentHash, type LocaleResource, type TranslationEntry } from "@verbatra/core";
import { type ExchangeError, readWorkbook, type WorkbookSheet } from "@verbatra/exchange";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import { computeFingerprint } from "../../cache/fingerprint.js";
import { feedTranslationMemory } from "../../cache/translation-memory.js";
import type { VerbatraConfig } from "../../config/schema.js";
import { SdkError } from "../../errors.js";
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
import { type ImportLocaleResult, importLocale } from "./import-locale.js";

/** On-disk size cap enforced before the untrusted workbook bytes reach `@verbatra/exchange`. */
const MAX_WORKBOOK_FILE_BYTES = 64 * 1024 * 1024;

/** Input for {@link importWorkbook}: the validated config, the workbook path, and run options. */
export interface ImportWorkbookInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Path to the filled workbook to import. */
  readonly workbook: string;
  /** Directory the file pattern, lock-file, and workbook path resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** When true, validate and report only: write no locale file and update no lock-file. */
  readonly dryRun?: boolean;
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

/** The accepted values as a source-content-hash to value record, this sheet's contribution to the cache. */
function sheetCacheAdditions(accepted: ImportLocaleResult["accepted"]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [, { value, source }] of accepted) {
    record[contentHash(source)] = value;
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
      `The workbook has a sheet for locale "${sheet.locale}", which is not a configured target locale.`,
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
 * Import a filled workbook back into the locale files. Each target-locale data sheet runs the same
 * source-drift, placeholder, and ICU checks as the translate flow, the accepted values are written
 * through the format adapter, and the lock is updated. Returns a {@link RunSummary} structurally
 * identical to `translate`'s.
 *
 * Whole-run failures (unknown format, unreadable/invalid/oversized workbook, corrupt lock) throw a
 * structured {@link SdkError}. A per-sheet failure (a locale not in config, a broken-round-trip key,
 * a write failure) is isolated as that locale's `status: "failed"`, not a throw; per-row rejections
 * are withheld and reported on the locale. Dry-run validates and reports without writing any locale or
 * lock file, and skips lock acquisition (there is nothing to protect).
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
  const workbookPath = resolve(cwd, input.workbook);
  const bytes = await readWorkbookBytes(workbookPath, fs);

  let data: Awaited<ReturnType<typeof readWorkbook>>;
  try {
    data = await readWorkbook(bytes);
  } catch (error) {
    throw new SdkError("SOURCE_INVALID", (error as ExchangeError).message);
  }

  const lock = await readLockFile(lockFilePath(cwd), fs);

  const ctx: SheetContext = {
    config,
    cwd,
    adapter,
    fs,
    source: source.resource,
    sourceInvalidIcuKeys: source.invalidIcuKeys,
    dryRun,
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

  if (!dryRun) {
    await feedTranslationMemory(cwd, fs, computeFingerprint(config), cacheAdditions);
  }

  const { succeeded, partial, failed } = partition(summaries);
  return { dryRun, locales: summaries, succeeded, partial, failed };
}
