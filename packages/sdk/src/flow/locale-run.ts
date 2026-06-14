import type {
  ProviderNotice,
  Tone,
  TranslateRequest,
  TranslationProvider,
} from "@verbatra/ai-providers";
import {
  contentHash,
  diffResources,
  type LocaleResource,
  type SupportedFormat,
  type TranslationEntry,
} from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";
import type { SdkFs } from "../fs.js";
import { localeFilePath } from "../paths.js";
import { readNotices } from "./notices.js";
import type { LocaleSummary } from "./summary.js";

export interface LocaleRunParams {
  readonly source: LocaleResource;
  readonly sourceInvalidIcuKeys: readonly string[];
  readonly baseline: ReadonlyMap<string, string>;
  readonly adapter: FormatAdapter;
  /** Undefined signals dry-run: the provider is neither constructed nor called. */
  readonly provider: TranslationProvider | undefined;
  readonly cwd: string;
  readonly filesPattern: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly format: SupportedFormat;
  readonly glossary: Readonly<Record<string, string>> | undefined;
  readonly tone: Tone | undefined;
  readonly fs: SdkFs;
}

export interface LocaleRunResult {
  readonly summary: LocaleSummary;
  readonly lockEntries: Record<string, string>;
}

interface Accepted {
  readonly value: string;
  readonly source: TranslationEntry;
}

function emptyResource(locale: string, format: SupportedFormat): LocaleResource {
  return { locale, namespace: "", format, entries: new Map() };
}

async function readTarget(params: LocaleRunParams): Promise<LocaleResource> {
  const path = localeFilePath(params.cwd, params.filesPattern, params.targetLocale);
  if (!(await params.fs.fileExists(path))) {
    return emptyResource(params.targetLocale, params.format);
  }
  return (await params.adapter.read(path, params.targetLocale)).resource;
}

function buildRequest(
  params: LocaleRunParams,
  entries: readonly TranslationEntry[],
): TranslateRequest {
  return {
    sourceLocale: params.sourceLocale,
    targetLocale: params.targetLocale,
    entries,
    extractPlaceholders: params.adapter.extractPlaceholders,
    ...(params.glossary !== undefined ? { glossary: params.glossary } : {}),
    ...(params.tone !== undefined ? { tone: params.tone } : {}),
  };
}

/**
 * Run one target locale: read + diff + (translate + integrity + write) + compute the
 * lock entries. A dry-run (provider undefined) stops after the diff and reports what
 * would be translated, calling no provider and writing nothing. May throw
 * (provider/adapter/IO); the orchestrator isolates that as a per-locale failure.
 */
export async function runLocale(params: LocaleRunParams): Promise<LocaleRunResult> {
  const target = await readTarget(params);
  const diff = diffResources(params.source, target, { baseline: params.baseline });

  const invalidIcu = new Set(params.sourceInvalidIcuKeys);
  const candidates = [...diff.missing, ...diff.changed];
  const toTranslate = candidates.filter((key) => !invalidIcu.has(key));
  const invalidIcuSource = candidates.filter((key) => invalidIcu.has(key));

  const provider = params.provider;
  if (provider === undefined) {
    return {
      summary: baseSummary(params.targetLocale, diff, invalidIcuSource, toTranslate, [], []),
      lockEntries: {},
    };
  }

  const entries = toTranslate
    .map((key) => params.source.entries.get(key))
    .filter((entry): entry is TranslationEntry => entry !== undefined);

  const accepted = new Map<string, Accepted>();
  const integrityMismatches: string[] = [];
  const notices = await translateAndCheck(provider, params, entries, accepted, integrityMismatches);

  const merged = new Map(target.entries);
  for (const [key, { value, source }] of accepted) {
    // Carry the source entry's fields but the TARGET's namespace and the translated value.
    merged.set(key, { ...source, value, namespace: target.namespace });
  }

  const path = localeFilePath(params.cwd, params.filesPattern, params.targetLocale);
  await params.adapter.write(
    {
      locale: params.targetLocale,
      namespace: target.namespace,
      format: params.format,
      entries: merged,
    },
    path,
  );

  const withheld = new Set([...integrityMismatches, ...invalidIcuSource]);
  return {
    summary: baseSummary(
      params.targetLocale,
      diff,
      invalidIcuSource,
      [...accepted.keys()],
      integrityMismatches,
      notices,
    ),
    lockEntries: computeLockEntries(params, merged, withheld),
  };
}

function baseSummary(
  locale: string,
  diff: ReturnType<typeof diffResources>,
  invalidIcuSource: readonly string[],
  translated: readonly string[],
  integrityMismatches: readonly string[],
  notices: readonly ProviderNotice[],
): LocaleSummary {
  return {
    locale,
    status: "succeeded",
    translated,
    unchanged: diff.unchanged,
    orphaned: diff.orphaned,
    invalidIcuSource,
    integrityMismatches,
    notices,
  };
}

async function translateAndCheck(
  provider: TranslationProvider,
  params: LocaleRunParams,
  entries: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
): Promise<readonly ProviderNotice[]> {
  if (entries.length === 0) {
    return [];
  }
  const result = await provider.translateBatch(buildRequest(params, entries));
  for (const entry of entries) {
    const value = result.values.get(entry.key);
    const integrity = result.integrity.get(entry.key);
    if (value !== undefined && integrity?.matches === true) {
      accepted.set(entry.key, { value, source: entry });
    } else {
      integrityMismatches.push(entry.key);
    }
  }
  return readNotices(result);
}

/**
 * Lock entries for the written target: the current source hash for every source-present
 * key, EXCEPT keys withheld for integrity failure or invalid-ICU this run (those keep
 * their prior baseline hash, so they retry next run). Unchanged source-present keys are
 * refreshed; orphaned keys get no entry.
 */
function computeLockEntries(
  params: LocaleRunParams,
  merged: ReadonlyMap<string, TranslationEntry>,
  withheld: ReadonlySet<string>,
): Record<string, string> {
  const lockEntries: Record<string, string> = {};
  for (const key of merged.keys()) {
    const sourceEntry = params.source.entries.get(key);
    if (sourceEntry === undefined) {
      continue;
    }
    if (withheld.has(key)) {
      const prior = params.baseline.get(key);
      if (prior !== undefined) {
        lockEntries[key] = prior;
      }
      continue;
    }
    lockEntries[key] = contentHash(sourceEntry);
  }
  return lockEntries;
}
