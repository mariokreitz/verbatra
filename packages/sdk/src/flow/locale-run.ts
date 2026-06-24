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
import {
  detectMissingPluralCategories,
  isGeneratedPluralKey,
  pluralIncompleteNotice,
  sourcePluralBaseKeys,
  targetPluralSetIncomplete,
} from "./plural-categories.js";
import { type GeneratedForm, generatePluralForms } from "./plural-generation.js";
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
   * When true, synthesize the CLDR plural forms a richer target language needs but the source lacks.
   * Only acts for an i18next-JSON project translated by an LLM provider; every other case falls back to
   * the PLURAL_CATEGORIES_INCOMPLETE warning. Off mirrors today's detect-and-warn behavior exactly.
   */
  readonly generatePlurals: boolean;
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

  // Generated plural forms (a target plural key whose base key has source plural forms) are not true
  // orphans: the source `items_few` may be absent while `items_one` / `items_other` exist. This protection
  // applies ONLY when generation is enabled: those forms will be regenerated, so keep them out of `orphaned`
  // and out of pruning. With generation off (the default), a source-absent plural-shaped key is a genuine
  // orphan and reported/pruned exactly like any other (pre-feature behavior).
  const orphaned = params.generatePlurals
    ? diff.orphaned.filter((key) => !isGeneratedPluralKey(key, sourcePluralBaseKeys(params.source)))
    : diff.orphaned;

  // Pruning removes exactly the orphaned keys, and only when on. `orphaned` is already sorted, so the
  // pruned list is deterministic; an empty list means "report orphans, remove nothing" (the default).
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
    // Dry-run: report what would be translated and what would be pruned; write nothing.
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
  const providerNotices = await translateAndCheck(
    provider,
    params,
    entries,
    accepted,
    integrityMismatches,
  );

  const merged = new Map(target.entries);
  // When pruning is on, drop orphaned keys before translations are merged in. Only diff.orphaned keys
  // (source-absent) are removed; accepted translations are all source-present and so never collide here.
  for (const key of pruned) {
    merged.delete(key);
  }
  for (const [key, { value, source }] of accepted) {
    // Carry the source entry's fields but the TARGET's namespace and the translated value.
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

  // When generation ran, the warning is decided from the WRITTEN set: it remains only if a required
  // category is still missing (a withheld form or an unsupported case). When generation was off, keep
  // the source-derived warning unchanged.
  const pluralNotices = params.generatePlurals ? pluralNoticeFor(params, merged) : sdkNotices;
  const notices: readonly LocaleNotice[] = [...pluralNotices, ...providerNotices];

  const withheld = new Set([...integrityMismatches, ...invalidIcuSource, ...generation.withheld]);
  return {
    summary: baseSummary({
      locale: params.targetLocale,
      unchanged: diff.unchanged,
      orphaned,
      invalidIcuSource,
      translated: [...accepted.keys()],
      generated: generation.accepted.map((form) => form.targetKey).sort(),
      // Withheld generated forms surface alongside withheld translations (spec D4): both failed integrity.
      integrityMismatches: [...integrityMismatches, ...generation.withheld].sort(),
      pruned,
      notices,
    }),
    lockEntries: computeLockEntries(params, merged, withheld, generation.accepted),
  };
}

/**
 * Run plural generation when enabled and the provider is an LLM. DeepL (machine-translation) and a
 * disabled option both skip generation so the run falls back to the warning, never a hard failure.
 */
async function runGeneration(
  params: LocaleRunParams,
  provider: TranslationProvider,
): Promise<{ accepted: readonly GeneratedForm[]; withheld: readonly string[] }> {
  if (!params.generatePlurals || provider.kind !== "llm") {
    return { accepted: [], withheld: [] };
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
  });
}

/**
 * The plural warning recomputed per base key against the written target (post-generation). It remains
 * only if a required category is still missing for some base key (a withheld form or an unsupported
 * case); a complete generated set clears it. A no-op for non-i18next (no plural keys are present).
 */
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
 *
 * Generated plural keys are source-ABSENT, so they get no source hash here. Each accepted generated form
 * carries its own governing-source hash ({@link GeneratedForm.lockHash}); these are recorded last so an
 * accepted generated key is not regenerated next run while its governing source forms are unchanged, and
 * IS reconsidered when they change. A previously-generated key that stays in the target but is NOT
 * regenerated this run carries its prior baseline hash forward, so its lock entry survives. A withheld
 * generated key gets no entry, so it is retried next run.
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
      // Carry a prior generated-plural lock entry forward so it is not lost when not regenerated.
      // Only when generation is enabled: with generation off, a source-absent key is a true orphan and
      // gets no lock entry carried forward (pre-feature behavior), so a pruned orphan loses its lock too.
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
