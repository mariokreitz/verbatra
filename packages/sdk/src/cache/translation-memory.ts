import { resolve } from "node:path";
import { z } from "zod";
import type { SdkFs } from "../fs.js";
import type { CacheAddition, TranslationMemory } from "./types.js";

/** The cache file's name, a sibling of the lock file and obviously JSON. */
export const CACHE_FILE_NAME = "verbatra.cache.json";

const CURRENT_VERSION = 1;
const EMPTY_MEMORY: TranslationMemory = { version: CURRENT_VERSION, entries: {} };

/** Size cap for the read: the cache is regenerable, so an oversized file simply degrades to empty. */
const MAX_CACHE_FILE_BYTES = 64 * 1024 * 1024;

const translationMemorySchema = z.object({
  version: z.number().int().positive(),
  entries: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.string()))),
});

/** Resolve the cache file's absolute path under `cwd`. */
export function cacheFilePath(cwd: string): string {
  return resolve(cwd, CACHE_FILE_NAME);
}

/**
 * Read the translation-memory cache into an immutable snapshot. Unlike `readLockFile`, this never
 * throws and never fails a run: a missing, oversized, unparseable, structurally invalid, or
 * unrecognized-version file all degrade to an empty cache. That degrade-to-empty is safe precisely
 * because the cache is regenerable: a bad file simply causes re-translation and is overwritten.
 *
 * @param path - The cache file path (see {@link cacheFilePath}).
 * @param fs - The file-system seam.
 * @returns The parsed memory, or an empty memory on any failure.
 */
export async function readTranslationMemory(path: string, fs: SdkFs): Promise<TranslationMemory> {
  const read = await fs.readFileBounded(path, MAX_CACHE_FILE_BYTES);
  if (read.kind !== "ok") {
    return EMPTY_MEMORY;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.content);
  } catch {
    return EMPTY_MEMORY;
  }
  const result = translationMemorySchema.safeParse(parsed);
  if (!result.success || result.data.version !== CURRENT_VERSION) {
    return EMPTY_MEMORY;
  }
  return result.data;
}

/**
 * Look one candidate up in the snapshot: the cached value for a fingerprint, target locale, and
 * source content hash, or undefined when absent. A hit is content-equal but must still pass the
 * integrity gate against the current source before being applied.
 */
export function lookupMemory(
  memory: TranslationMemory,
  fingerprint: string,
  locale: string,
  contentHash: string,
): string | undefined {
  return memory.entries[fingerprint]?.[locale]?.[contentHash];
}

/**
 * Overlay a run's per-locale additions onto a base memory under one fingerprint, returning a new
 * memory. Existing entries for other fingerprints and other locales are preserved untouched; a new
 * value for an existing content hash overwrites it. Returns the base unchanged when there is nothing
 * to add.
 */
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

/** Turn a list of additions into the content-hash-to-value record one locale contributes. */
export function additionsToRecord(additions: readonly CacheAddition[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const addition of additions) {
    record[addition.contentHash] = addition.value;
  }
  return record;
}

function sortEntries<T>(record: Readonly<Record<string, T>>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1));
}

/** Serialize deterministically with every level's keys sorted, for a stable file across runs. */
function serialize(memory: TranslationMemory): string {
  const entries: Record<string, Record<string, Record<string, string>>> = {};
  for (const [fingerprint, locales] of sortEntries(memory.entries)) {
    const localeMap: Record<string, Record<string, string>> = {};
    for (const [locale, hashes] of sortEntries(locales)) {
      localeMap[locale] = Object.fromEntries(sortEntries(hashes));
    }
    entries[fingerprint] = localeMap;
  }
  return `${JSON.stringify({ version: memory.version, entries }, null, 2)}\n`;
}

/**
 * Write the cache file. Best-effort by the caller's contract: a write failure must never fail a run,
 * so every call site wraps this in a swallow. The write itself is atomic (temp file then rename) via
 * the `SdkFs` seam.
 */
export async function writeTranslationMemory(
  path: string,
  memory: TranslationMemory,
  fs: SdkFs,
): Promise<void> {
  await fs.writeFile(path, serialize(memory));
}

/**
 * Fully best-effort read-modify-write that folds accepted values into the cache under one fingerprint.
 * The single-shot write path for the flows that only feed the cache and never read it (`editEntry`,
 * `retranslateEntry`, `importWorkbook`): it reads the current cache, overlays the additions, and writes
 * once, swallowing every failure so a cache problem can never turn an accepted write into a run
 * failure. A no-op when there is nothing to add. Last-writer-wins on concurrent writers, which is
 * acceptable for a regenerable optimization.
 */
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
    const memory = await readTranslationMemory(path, fs);
    await writeTranslationMemory(path, applyAdditions(memory, fingerprint, additionsByLocale), fs);
  } catch {}
}
