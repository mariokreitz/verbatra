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

export const DEFAULT_WORKBOOK_PATH = "verbatra-translations.xlsx";

export const DEFAULT_DELIMITED_PATH = "verbatra-translations";

export interface ExportWorkbookInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly out?: string;
  readonly locales?: readonly string[];
  readonly includeUnchanged?: boolean;
  readonly format?: ExchangeFormat;
}

export interface ExportWorkbookDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

export interface ExportWorkbookResult {
  readonly path: string;
  readonly locales: readonly { readonly locale: string; readonly rows: number }[];
}

function reasonLabel(reason: string): string {
  return reason.toLowerCase().replace(/_/g, "-");
}

function reviewColumns(flag: ReviewFlag | undefined): {
  reviewStatus: ReviewStatus;
  reviewReasons: string;
} {
  if (flag === undefined) {
    return { reviewStatus: "ok", reviewReasons: "" };
  }
  return { reviewStatus: "review", reviewReasons: flag.reasons.map(reasonLabel).join(", ") };
}

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
