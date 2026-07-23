import {
  ProviderError,
  type ReviewReasonCode,
  type TranslateRequest,
} from "@verbatra/ai-providers";
import { contentHash, type TranslationEntry } from "@verbatra/core";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import { computeFingerprint } from "../cache/fingerprint.js";
import { feedTranslationMemory } from "../cache/translation-memory.js";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { withLocaleWriteLock } from "../lock/locale-write-lock.js";
import { updateLockFileLocale } from "../lock/lock-file.js";
import { localeFilePath } from "../paths.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { type CreateProvider, selectProvider } from "../selection/select-provider.js";
import { readTarget } from "./diff-locales.js";
import { gateCandidateValue, type IntegrityGateReason } from "./integrity-gate.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

/** Input for {@link retranslateEntry}: the validated config and exactly one target locale/key pair. */
export interface RetranslateEntryInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** The target locale to retranslate the key into. Must be a configured target locale. */
  readonly locale: string;
  /** The source key to retranslate. Must exist in the source resource. */
  readonly key: string;
}

/** Composition seam for {@link retranslateEntry}: inject a registry, a provider builder, and a file system for tests. */
export interface RetranslateEntryDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly createProvider?: CreateProvider;
  readonly fs?: SdkFs;
}

/**
 * The two-armed result of one retranslate attempt: `accepted` carries the newly written value and
 * any derived "needs review" reasons; a rejection carries the candidate value and which
 * {@link gateCandidateValue} check failed it, without writing anything.
 */
export type RetranslateEntryResult =
  | {
      readonly accepted: true;
      readonly value: string;
      readonly reviewReasons: readonly ReviewReasonCode[];
    }
  | {
      readonly accepted: false;
      readonly reason: IntegrityGateReason;
      readonly value: string;
    };

function buildSingleEntryRequest(
  config: VerbatraConfig,
  locale: string,
  sourceEntry: TranslationEntry,
  adapter: FormatAdapter,
): TranslateRequest {
  return {
    sourceLocale: config.sourceLocale,
    targetLocale: locale,
    entries: [sourceEntry],
    extractPlaceholders: adapter.extractPlaceholders,
    ...(config.glossary !== undefined ? { glossary: config.glossary } : {}),
    ...(config.tone !== undefined ? { tone: config.tone } : {}),
    ...(adapter.comparePlaceholders !== undefined
      ? { comparePlaceholders: adapter.comparePlaceholders }
      : {}),
  };
}

/**
 * Retranslate exactly one key for exactly one target locale: a single-entry `translateBatch` call
 * through the same provider registry `translate()` uses, gated through the shared
 * {@link gateCandidateValue} before anything reaches disk. On acceptance, writes the target locale
 * file (merging just this one key into its current entries, every other key untouched) and updates
 * the lock entry for this key only (see {@link updateLockFileLocale}'s `"merge"` mode); on rejection,
 * writes nothing. Reuses exactly the building blocks `translate()` already uses
 * (`selectProvider`/`provider.translateBatch`) and nothing else: no bespoke per-provider plumbing.
 * Always calls the provider (it never consults the cache for a hit, since its whole purpose is a
 * fresh translation), then feeds the accepted value into the translation-memory cache best-effort so
 * a later run can reuse it; a cache failure is swallowed and never fails the retranslate.
 *
 * `locale` and `key` are resolved fresh on every call, never cached: `locale` against
 * `config.targetLocales` (`UNKNOWN_LOCALE`), `key` against the source resource's own keys, read
 * fresh from disk (`UNKNOWN_KEY`), via a `Map`-backed lookup, never `key in obj` or
 * `obj[key] !== undefined` against a plain object.
 *
 * The target-file write and the lock-file update run inside the same held
 * `withLocaleWriteLock(cwd, locale, fs, ...)` critical section as the provider call itself, so no
 * second writer for this locale can ever observe the target file updated but the lock entry not
 * yet, or vice versa. The same locking also covers `translate()`/`watch()` and `importWorkbook()`.
 *
 * Not atomic across the two writes for a single caller's own run: the target locale file is
 * written before the lock entry is updated. If `updateLockFileLocale` then throws
 * (`LOCK_FILE_INVALID` for a corrupt lock-file, or `LOCK_CONTENDED` if its own internal lock-file
 * guard cannot be acquired before its timeout), the target file already carries the new value
 * while the lock still records the old hash, and the thrown error does not imply nothing was
 * saved. The same ordering, and the same partial-write shape on that rare path, also exists in
 * `translate()` and `importWorkbook()`.
 *
 * @param input - The validated config, the target locale, and the source key to retranslate.
 * @param deps - Optional composition seams (registry, provider builder, file system) for tests.
 * @returns The two-armed {@link RetranslateEntryResult}.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`: no adapter is registered for the configured format.
 * @throws {@link SdkError} `UNKNOWN_LOCALE`: `locale` is not among `config.targetLocales`.
 * @throws {@link SdkError} `SOURCE_UNREADABLE` / `SOURCE_INVALID`: the source locale file is absent
 *   or unreadable.
 * @throws {@link SdkError} `UNKNOWN_KEY`: `key` does not exist in the source resource.
 * @throws {@link SdkError} `PROVIDER_CONSTRUCTION_FAILED`: the provider factory threw (wraps a
 *   missing `*_API_KEY` as `MISSING_API_KEY`).
 * @throws {@link ProviderError} the provider call itself failed, or returned no value at all for
 *   this key (`INVALID_RESPONSE`).
 * @throws {@link SdkError} `LOCK_FILE_INVALID`: the lock-file is corrupt, oversized, or at an
 *   unsupported version.
 * @throws {@link SdkError} `LOCK_CONTENDED`: this locale's write lock could not be acquired before
 *   its timeout, because another process (another CLI run, or a second Studio write) is holding it.
 */
export async function retranslateEntry(
  input: RetranslateEntryInput,
  deps: RetranslateEntryDeps = {},
): Promise<RetranslateEntryResult> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);

  const [locale] = selectLocales(config, [input.locale]);
  /* v8 ignore next 3 -- selectLocales with a one-element requested array either throws UNKNOWN_LOCALE or returns that exact element; `locale` is never undefined here. */
  if (locale === undefined) {
    throw new SdkError("UNKNOWN_LOCALE", `Locale "${input.locale}" could not be resolved.`);
  }

  const source = await readSource(config, cwd, fs, adapter);
  const sourceEntry = source.resource.entries.get(input.key);
  if (sourceEntry === undefined) {
    throw new SdkError(
      "UNKNOWN_KEY",
      `The key "${input.key}" was not found in the source resource.`,
    );
  }

  const provider = selectProvider(config.provider, deps.createProvider);

  return withLocaleWriteLock(cwd, locale, fs, async () => {
    const target = await readTarget(cwd, config, adapter, fs, locale);

    const result = await provider.translateBatch(
      buildSingleEntryRequest(config, locale, sourceEntry, adapter),
    );
    const value = result.values.get(input.key);
    if (value === undefined) {
      throw new ProviderError(
        "INVALID_RESPONSE",
        `The provider returned no translated value for key "${input.key}".`,
      );
    }

    const gate = gateCandidateValue(sourceEntry, value, adapter);
    if (!gate.accepted) {
      return { accepted: false, reason: gate.reason, value };
    }

    const merged = new Map(target.entries);
    merged.set(input.key, { ...sourceEntry, value, namespace: target.namespace });
    const path = localeFilePath(cwd, config.files.pattern, locale);
    await adapter.write(
      { locale, namespace: target.namespace, format: config.format, entries: merged },
      path,
    );

    await updateLockFileLocale(cwd, fs, locale, {
      mode: "merge",
      entries: { [input.key]: contentHash(sourceEntry) },
    });

    await feedTranslationMemory(
      cwd,
      fs,
      computeFingerprint(config),
      new Map([[locale, { [contentHash(sourceEntry)]: value }]]),
    );

    const reviewReasons = result.reviewFlags?.get(input.key)?.reasons ?? [];
    return { accepted: true, value, reviewReasons };
  });
}
