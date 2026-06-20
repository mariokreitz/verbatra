import { resolve } from "node:path";
import { contentHash, type LocaleResource, type TranslationEntry } from "@verbatra/core";
import { type ExchangeError, readWorkbook, type WorkbookSheet } from "@verbatra/exchange";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../../config/schema.js";
import { SdkError } from "../../errors.js";
import { defaultFs, type SdkFs } from "../../fs.js";
import {
  baselineFor,
  lockFilePath,
  readLockFile,
  updateLockLocale,
  writeLockFile,
} from "../../lock/lock-file.js";
import type { LockFile } from "../../lock/types.js";
import { localeFilePath } from "../../paths.js";
import { selectAdapter } from "../../selection/select-adapter.js";
import { failureSummary, partition } from "../locale-failure.js";
import { readSource } from "../source.js";
import type { LocaleSummary, RunSummary } from "../summary.js";
import { type ImportLocaleResult, importLocale } from "./import-locale.js";

/**
 * On-disk cap for the untrusted workbook read: the SDK's bounded read enforces this size before the
 * bytes reach `@verbatra/exchange`, where the decompressed-byte and structural caps then apply.
 */
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

/**
 * Read the workbook through the SDK's bounded read, enforcing the on-disk cap.
 *
 * @throws {@link SdkError} `SOURCE_UNREADABLE` if the file is missing, `SOURCE_INVALID` if it
 *   exceeds {@link MAX_WORKBOOK_FILE_BYTES}
 */
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

/** Merge accepted values onto the existing target, carrying the source fields and target namespace. */
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
 * Lock entries for the written target: a fresh source hash for every source-present key EXCEPT a
 * withheld one (drift/placeholder/ICU), which keeps its prior baseline hash so it re-exports next
 * run. Identical discipline to the provider path's `computeLockEntries`.
 */
function computeLockEntries(
  source: LocaleResource,
  merged: ReadonlyMap<string, TranslationEntry>,
  baseline: ReadonlyMap<string, string>,
  withheld: ReadonlySet<string>,
): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const key of merged.keys()) {
    const sourceEntry = source.entries.get(key);
    if (sourceEntry === undefined) {
      continue;
    }
    if (withheld.has(key)) {
      const prior = baseline.get(key);
      if (prior !== undefined) {
        entries[key] = prior;
      }
      continue;
    }
    entries[key] = contentHash(sourceEntry);
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

/** Run one data sheet: judge rows, then (unless dry-run) write the locale file and return entries. */
async function runSheet(
  ctx: SheetContext,
  sheet: WorkbookSheet,
  lock: LockFile,
): Promise<{ summary: LocaleSummary; lockEntries: Record<string, string> }> {
  if (!ctx.config.targetLocales.includes(sheet.locale)) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The workbook has a sheet for locale "${sheet.locale}", which is not a configured target locale.`,
    );
  }
  const target = await readTarget(ctx.cwd, ctx.config, ctx.adapter, ctx.fs, sheet.locale);
  const baseline = baselineFor(lock, sheet.locale);
  const { summary, accepted, withheld } = importLocale({
    sheet,
    source: ctx.source,
    target,
    baseline,
    adapter: ctx.adapter,
    sourceInvalidIcuKeys: ctx.sourceInvalidIcuKeys,
  });

  if (ctx.dryRun) {
    return { summary, lockEntries: {} };
  }

  const merged = mergeAccepted(target, accepted);
  // Skip the file write when nothing new was accepted (no content change), but always recompute the
  // lock from the merged set so existing source-present keys stay refreshed and withheld keys keep
  // their prior baseline; never wipe the locale's lock just because this run wrote nothing.
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
  return { summary, lockEntries: computeLockEntries(ctx.source, merged, baseline, withheld) };
}

/**
 * Import a filled workbook back into the locale files. Reads the untrusted workbook through the
 * SDK's bounded read, parses it with `@verbatra/exchange`'s `readWorkbook` (which bounds and
 * sanitizes it), then for each target-locale data sheet runs the EXISTING core checks (source-drift
 * via `contentHash`, placeholder integrity via `checkPlaceholders`, ICU via the adapter's
 * `validateMessage`), writes the accepted values through the format adapter, and updates the lock
 * through the existing lock logic. Returns a {@link RunSummary} structurally identical to
 * `translate`'s, so the CLI formatter and exit-code rule are shared with no special case.
 *
 * Whole-run failures (unknown format, unreadable/invalid/oversized workbook, corrupt lock) throw a
 * structured {@link SdkError}. A per-sheet failure (a locale not in config, a broken-round-trip key,
 * a write failure) is isolated as that locale's `status: "failed"`, not a throw; per-row rejections
 * are withheld and reported on the locale, exactly as the provider path treats integrity mismatches.
 * `--dry-run` validates and reports without writing any locale or lock file.
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
  // The workbook input is a plain (non-locale) path: resolve it directly against cwd.
  const workbookPath = resolve(cwd, input.workbook);
  const bytes = await readWorkbookBytes(workbookPath, fs);

  let data: Awaited<ReturnType<typeof readWorkbook>>;
  try {
    data = await readWorkbook(bytes);
  } catch (error) {
    // A structural workbook problem is a whole-run failure: surface its WORKBOOK_INVALID code.
    throw new SdkError("SOURCE_INVALID", (error as ExchangeError).message);
  }

  const lockPath = lockFilePath(cwd);
  let lock = await readLockFile(lockPath, fs);

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
  for (const sheet of data.sheets) {
    try {
      const { summary, lockEntries } = await runSheet(ctx, sheet, lock);
      if (!dryRun) {
        // Replace the locale's entries with the freshly computed set, exactly as the provider path
        // does: computeLockEntries already carries every source-present key (refreshed or withheld),
        // and an orphaned key correctly drops out.
        lock = updateLockLocale(lock, sheet.locale, lockEntries);
        await writeLockFile(lockPath, lock, fs);
      }
      summaries.push(summary);
    } catch (error) {
      // A per-sheet failure (locale not in config, broken-round-trip key, write error) is isolated
      // as that locale's failure, not a throw: the rest of the workbook still imports.
      summaries.push(failureSummary(sheet.locale, error));
    }
  }

  const { succeeded, failed } = partition(summaries);
  return { dryRun, locales: summaries, succeeded, failed };
}
