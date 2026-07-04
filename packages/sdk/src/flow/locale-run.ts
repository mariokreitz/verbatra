import type {
  Tone,
  TranslateRequest,
  TranslateResult,
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
import { chunk, subBatchFailedNotice } from "./batching.js";
import { readNotices } from "./notices.js";
import {
  detectMissingPluralCategories,
  isGeneratedPluralKey,
  pluralIncompleteNotice,
  sourcePluralBaseKeys,
  targetPluralSetIncomplete,
} from "./plural-categories.js";
import {
  type GeneratedForm,
  generatePluralForms,
  type PluralGenerationResult,
} from "./plural-generation.js";
import type { LocaleNotice, LocaleSummary } from "./summary.js";

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
  /** When true, orphaned keys (diff.orphaned) are removed from the written file and the lock. */
  readonly prune: boolean;
  /**
   * When true, synthesize the CLDR plural forms a richer target language needs but the source lacks
   * (i18next-JSON + LLM provider only); every other case falls back to the warning.
   */
  readonly generatePlurals: boolean;
  /**
   * Maximum entries per provider request. Entries are split into sequential sub-batches no larger than
   * this. A positive integer, guaranteed by the config schema.
   */
  readonly maxBatchSize: number;
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
 * Run one target locale: read, diff, translate, integrity-check, write, and compute the lock entries.
 * A dry-run (provider undefined) stops after the diff. May throw; the orchestrator isolates that as a
 * per-locale failure.
 */
export async function runLocale(params: LocaleRunParams): Promise<LocaleRunResult> {
  const target = await readTarget(params);
  const diff = diffResources(params.source, target, { baseline: params.baseline });

  // Generated plural forms are not true orphans, so when generation is on keep them out of orphaned/pruning.
  const orphaned = params.generatePlurals
    ? diff.orphaned.filter((key) => !isGeneratedPluralKey(key, sourcePluralBaseKeys(params.source)))
    : diff.orphaned;

  const pruned: readonly string[] = params.prune ? orphaned : [];

  const invalidIcu = new Set(params.sourceInvalidIcuKeys);
  const candidates = [...diff.missing, ...diff.changed];
  const toTranslate = candidates.filter((key) => !invalidIcu.has(key));
  const invalidIcuSource = candidates.filter((key) => invalidIcu.has(key));

  const pluralNotice = detectMissingPluralCategories(
    params.source,
    params.targetLocale,
    params.format,
  );
  const sdkNotices: readonly LocaleNotice[] = pluralNotice ? [pluralNotice] : [];

  const provider = params.provider;
  if (provider === undefined) {
    // Dry-run: report what would change, write nothing.
    return {
      summary: baseSummary({
        locale: params.targetLocale,
        unchanged: diff.unchanged,
        orphaned,
        invalidIcuSource,
        translated: toTranslate,
        generated: [],
        integrityMismatches: [],
        pruned,
        notices: sdkNotices,
      }),
      lockEntries: {},
    };
  }

  const entries = toTranslate
    .map((key) => params.source.entries.get(key))
    .filter((entry): entry is TranslationEntry => entry !== undefined);

  const accepted = new Map<string, Accepted>();
  const integrityMismatches: string[] = [];
  const subBatchNotices = await translateAndCheck(
    provider,
    params,
    entries,
    accepted,
    integrityMismatches,
  );

  const merged = new Map(target.entries);
  // Drop pruned (source-absent) orphans before merging; accepted keys are source-present and never collide.
  for (const key of pruned) {
    merged.delete(key);
  }
  for (const [key, { value, source }] of accepted) {
    // Carry the source entry's fields but the target's namespace and the translated value.
    merged.set(key, { ...source, value, namespace: target.namespace });
  }

  const generation = await runGeneration(params, provider);
  for (const form of generation.accepted) {
    merged.set(form.targetKey, { ...form.entry, namespace: target.namespace });
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

  const pluralNotices = params.generatePlurals ? pluralNoticeFor(params, merged) : sdkNotices;
  const notices: readonly LocaleNotice[] = [
    ...pluralNotices,
    ...subBatchNotices,
    ...generation.notices,
  ];

  const withheld = new Set([...integrityMismatches, ...invalidIcuSource, ...generation.withheld]);
  return {
    summary: baseSummary({
      locale: params.targetLocale,
      unchanged: diff.unchanged,
      orphaned,
      invalidIcuSource,
      translated: [...accepted.keys()],
      generated: generation.accepted.map((form) => form.targetKey).sort(),
      // Withheld generated forms surface alongside withheld translations: both failed integrity.
      integrityMismatches: [...integrityMismatches, ...generation.withheld].sort(),
      pruned,
      notices,
    }),
    lockEntries: computeLockEntries(params, merged, withheld, generation.accepted),
  };
}

/** Run plural generation when enabled and the provider is an LLM; otherwise skip and fall back to the warning. */
async function runGeneration(
  params: LocaleRunParams,
  provider: TranslationProvider,
): Promise<PluralGenerationResult> {
  if (!params.generatePlurals || provider.kind !== "llm") {
    return { accepted: [], withheld: [], notices: [] };
  }
  return generatePluralForms({
    source: params.source,
    sourceLocale: params.sourceLocale,
    targetLocale: params.targetLocale,
    format: params.format,
    adapter: params.adapter,
    provider,
    glossary: params.glossary,
    tone: params.tone,
    baseline: params.baseline,
    maxBatchSize: params.maxBatchSize,
  });
}

/** Recompute the plural warning per base key against the written target; a complete generated set clears it. */
function pluralNoticeFor(
  params: LocaleRunParams,
  merged: ReadonlyMap<string, TranslationEntry>,
): readonly LocaleNotice[] {
  if (params.format !== "i18next-json") {
    return [];
  }
  if (!targetPluralSetIncomplete(merged.keys(), params.targetLocale)) {
    return [];
  }
  return [pluralIncompleteNotice(params.targetLocale)];
}

interface SummaryParts {
  readonly locale: string;
  readonly unchanged: readonly string[];
  readonly orphaned: readonly string[];
  readonly invalidIcuSource: readonly string[];
  readonly translated: readonly string[];
  readonly generated: readonly string[];
  readonly integrityMismatches: readonly string[];
  readonly pruned: readonly string[];
  readonly notices: readonly LocaleNotice[];
}

function baseSummary(parts: SummaryParts): LocaleSummary {
  return {
    locale: parts.locale,
    status: "succeeded",
    translated: parts.translated,
    unchanged: parts.unchanged,
    orphaned: parts.orphaned,
    pruned: parts.pruned,
    invalidIcuSource: parts.invalidIcuSource,
    integrityMismatches: parts.integrityMismatches,
    generated: parts.generated,
    notices: parts.notices,
  };
}

/** Split entries into sequential sub-batches of at most `maxBatchSize` and run each as its own request. */
async function translateAndCheck(
  provider: TranslationProvider,
  params: LocaleRunParams,
  entries: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
): Promise<readonly LocaleNotice[]> {
  const notices: LocaleNotice[] = [];
  for (const batch of chunk(entries, params.maxBatchSize)) {
    const subNotices = await runSubBatch(provider, params, batch, accepted, integrityMismatches);
    notices.push(...subNotices);
  }
  return notices;
}

/**
 * Run one sub-batch and fold its result into `accepted` / `integrityMismatches`. A thrown provider call
 * is caught and never surfaced: the whole sub-batch is withheld and a secret-free notice is returned.
 */
async function runSubBatch(
  provider: TranslationProvider,
  params: LocaleRunParams,
  batch: readonly TranslationEntry[],
  accepted: Map<string, Accepted>,
  integrityMismatches: string[],
): Promise<readonly LocaleNotice[]> {
  let result: TranslateResult;
  try {
    result = await provider.translateBatch(buildRequest(params, batch));
  } catch {
    for (const entry of batch) {
      integrityMismatches.push(entry.key);
    }
    return [subBatchFailedNotice(batch.length)];
  }
  for (const entry of batch) {
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
 * Lock entries for the written target: the current source hash for every source-present key, except keys
 * withheld this run (those keep their prior baseline hash so they retry). Generated plural keys are
 * source-absent and instead carry their own governing-source hash ({@link GeneratedForm.lockHash}).
 */
function computeLockEntries(
  params: LocaleRunParams,
  merged: ReadonlyMap<string, TranslationEntry>,
  withheld: ReadonlySet<string>,
  generated: readonly GeneratedForm[],
): Record<string, string> {
  const lockEntries: Record<string, string> = {};
  const sourceBaseKeys = sourcePluralBaseKeys(params.source);
  for (const key of merged.keys()) {
    const sourceEntry = params.source.entries.get(key);
    if (sourceEntry === undefined) {
      // Carry a prior generated-plural lock entry forward (only when generation is enabled).
      if (params.generatePlurals) {
        carryGeneratedLock(lockEntries, params.baseline, key, sourceBaseKeys);
      }
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
  for (const form of generated) {
    lockEntries[form.targetKey] = form.lockHash;
  }
  return lockEntries;
}

/** Preserve a prior lock entry for a generated plural key that stayed in the target but was not regenerated. */
function carryGeneratedLock(
  lockEntries: Record<string, string>,
  baseline: ReadonlyMap<string, string>,
  key: string,
  sourceBaseKeys: ReadonlySet<string>,
): void {
  if (!isGeneratedPluralKey(key, sourceBaseKeys)) {
    return;
  }
  const prior = baseline.get(key);
  if (prior !== undefined) {
    lockEntries[key] = prior;
  }
}
