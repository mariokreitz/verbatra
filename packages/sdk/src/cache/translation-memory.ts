import { resolve } from "node:path";
import { z } from "zod";
import type { BoundedFileRead, SdkFs } from "../fs.js";
import { sortRecordKeys } from "../record-utils.js";
import type { CacheAddition, TranslationMemory } from "./types.js";

/**
 * The file name of the project's translation memory, resolved against the run's working directory.
 * Commit it to reuse translations across machines and CI runs, or add it to `.gitignore` to treat
 * the cache as purely local. Deleting it is always safe: the next run simply repays for the strings
 * it would have reused.
 */
export const CACHE_FILE_NAME = "verbatra.cache.json";

const CURRENT_VERSION = 1;
const EMPTY_MEMORY: TranslationMemory = { version: CURRENT_VERSION, entries: {} };

const MAX_CACHE_FILE_BYTES = 64 * 1024 * 1024;

const translationMemorySchema = z.object({
  version: z.number().int().positive(),
  entries: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.string()))),
});

export function cacheFilePath(cwd: string): string {
  return resolve(cwd, CACHE_FILE_NAME);
}

export interface TranslationMemoryRead {
  readonly memory: TranslationMemory;
  readonly writable: boolean;
}

const UNUSABLE: TranslationMemoryRead = { memory: EMPTY_MEMORY, writable: true };

export async function readTranslationMemory(
  path: string,
  fs: SdkFs,
): Promise<TranslationMemoryRead> {
  let read: BoundedFileRead;
  try {
    read = await fs.readFileBounded(path, MAX_CACHE_FILE_BYTES);
  } catch {
    return UNUSABLE;
  }
  if (read.kind !== "ok") {
    return UNUSABLE;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.content);
  } catch {
    return UNUSABLE;
  }
  const result = translationMemorySchema.safeParse(parsed);
  if (!result.success) {
    return UNUSABLE;
  }
  if (result.data.version !== CURRENT_VERSION) {
    return { memory: EMPTY_MEMORY, writable: false };
  }
  return { memory: result.data, writable: true };
}

export function lookupMemory(
  memory: TranslationMemory,
  fingerprint: string,
  locale: string,
  contentHash: string,
): string | undefined {
  return memory.entries[fingerprint]?.[locale]?.[contentHash];
}

export function applyAdditions(
  base: TranslationMemory,
  fingerprint: string,
  additionsByLocale: ReadonlyMap<string, Readonly<Record<string, string>>>,
): TranslationMemory {
  if (additionsByLocale.size === 0) {
    return base;
  }
  const fingerprintEntries: Record<string, Record<string, string>> = {};
  for (const [locale, hashes] of Object.entries(base.entries[fingerprint] ?? {})) {
    fingerprintEntries[locale] = { ...hashes };
  }
  for (const [locale, hashes] of additionsByLocale) {
    fingerprintEntries[locale] = { ...fingerprintEntries[locale], ...hashes };
  }
  return {
    version: base.version,
    entries: { ...base.entries, [fingerprint]: fingerprintEntries },
  };
}

export function additionsToRecord(additions: readonly CacheAddition[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const addition of additions) {
    record[addition.contentHash] = addition.value;
  }
  return record;
}

function serialize(memory: TranslationMemory): string {
  const entries: Record<string, Record<string, Record<string, string>>> = {};
  for (const [fingerprint, locales] of Object.entries(sortRecordKeys(memory.entries))) {
    const localeMap: Record<string, Record<string, string>> = {};
    for (const [locale, hashes] of Object.entries(sortRecordKeys(locales))) {
      localeMap[locale] = sortRecordKeys(hashes);
    }
    entries[fingerprint] = localeMap;
  }
  return `${JSON.stringify({ version: memory.version, entries }, null, 2)}\n`;
}

export async function writeTranslationMemory(
  path: string,
  memory: TranslationMemory,
  fs: SdkFs,
): Promise<void> {
  await fs.writeFile(path, serialize(memory));
}

export async function feedTranslationMemory(
  cwd: string,
  fs: SdkFs,
  fingerprint: string,
  additionsByLocale: ReadonlyMap<string, Readonly<Record<string, string>>>,
): Promise<void> {
  if (additionsByLocale.size === 0) {
    return;
  }
  try {
    const path = cacheFilePath(cwd);
    const { memory, writable } = await readTranslationMemory(path, fs);
    if (!writable) {
      return;
    }
    await writeTranslationMemory(path, applyAdditions(memory, fingerprint, additionsByLocale), fs);
  } catch {}
}
