import { resolve } from "node:path";
import { z } from "zod";
import { SdkError } from "../errors.js";
import type { BoundedFileRead, SdkFs } from "../fs.js";
import { withLockFileGuard } from "./locale-write-lock.js";
import type { LockEntries, LockFile } from "./types.js";

/** The committed lock-file name, chosen to be obviously JSON and to not match a `*.lock` ignore rule. */
export const LOCK_FILE_NAME = "verbatra.lock.json";

const CURRENT_VERSION = 1;
const EMPTY_LOCK: LockFile = { version: CURRENT_VERSION, locales: {} };

/** Size cap for the lock-file read: it is committed and tamperable, so the read is bounded. */
const MAX_LOCK_FILE_BYTES = 16 * 1024 * 1024;

const lockFileSchema = z.object({
  version: z.number().int().positive(),
  locales: z.record(z.string(), z.record(z.string(), z.string())),
});

export function lockFilePath(cwd: string): string {
  return resolve(cwd, LOCK_FILE_NAME);
}

/**
 * Parse a bounded read of the lock-file's raw content into a {@link LockFile}. A missing file
 * degrades to an empty lock (first-run); an oversized, unparseable, structurally invalid, or
 * wrong-version file is a structured `LOCK_FILE_INVALID` error so it is never silently
 * overwritten or misinterpreted under the wrong version's semantics. Shared by {@link readLockFile}
 * and {@link updateLockFileLocale}'s own re-reads, so both apply exactly the same validation.
 */
function parseLockFileRead(read: BoundedFileRead, path: string): LockFile {
  if (read.kind === "missing") {
    return EMPTY_LOCK;
  }
  if (read.kind === "too-large") {
    throw new SdkError(
      "LOCK_FILE_INVALID",
      `The lock-file at ${path} exceeds the maximum allowed size of ${MAX_LOCK_FILE_BYTES} bytes.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.content);
  } catch {
    throw new SdkError("LOCK_FILE_INVALID", `The lock-file at ${path} is not valid JSON.`);
  }
  const result = lockFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new SdkError("LOCK_FILE_INVALID", `The lock-file at ${path} has an unexpected shape.`);
  }
  // Only CURRENT_VERSION is understood, so this checks inequality rather than just "greater
  // than". Today the schema's positive-integer constraint makes version < CURRENT_VERSION
  // unreachable (1 is the floor), so in practice this only ever catches version >
  // CURRENT_VERSION. But there is no migration path for an older format either, so the
  // inequality is deliberate: once CURRENT_VERSION is bumped past 1, an old file stamped with
  // the previous version must keep failing loudly here rather than silently passing.
  if (result.data.version !== CURRENT_VERSION) {
    throw new SdkError(
      "LOCK_FILE_INVALID",
      `The lock-file at ${path} has version ${result.data.version}, but this version of verbatra supports version ${CURRENT_VERSION}.`,
    );
  }
  return result.data;
}

/**
 * Read the lock-file. A missing file degrades to an empty lock (first-run); a corrupt file or a
 * `version` other than {@link CURRENT_VERSION} is a structured error so it is never silently
 * overwritten or misinterpreted under the wrong version's semantics.
 */
export async function readLockFile(path: string, fs: SdkFs): Promise<LockFile> {
  return parseLockFileRead(await fs.readFileBounded(path, MAX_LOCK_FILE_BYTES), path);
}

/** The recorded baseline for one locale, as the map core's diff expects. */
export function baselineFor(lock: LockFile, locale: string): ReadonlyMap<string, string> {
  return new Map(Object.entries(lock.locales[locale] ?? {}));
}

/** Return a new lock with one locale's entries replaced. */
export function updateLockLocale(lock: LockFile, locale: string, entries: LockEntries): LockFile {
  return {
    version: lock.version,
    locales: { ...lock.locales, [locale]: entries },
  };
}

function byKey(a: readonly [string, unknown], b: readonly [string, unknown]): number {
  return a[0] < b[0] ? -1 : 1;
}

function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(byKey));
}

/** Serialize the lock-file deterministically (sorted keys) for human-readable diffs. */
function serializeLockFile(lock: LockFile): string {
  const locales: Record<string, Record<string, string>> = {};
  for (const [locale, entries] of Object.entries(lock.locales).sort(byKey)) {
    locales[locale] = sortRecord(entries);
  }
  const ordered = { version: lock.version, locales };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** Serialize and write the lock-file deterministically (sorted keys) for human-readable diffs. */
export async function writeLockFile(path: string, lock: LockFile, fs: SdkFs): Promise<void> {
  await fs.writeFile(path, serializeLockFile(lock));
}

/**
 * How {@link updateLockFileLocale} folds its caller's computed entries into one locale's current
 * on-disk entries: `"replace"` discards every existing key for that locale in favor of the given
 * entries (translate()'s and workbook import's own full per-locale recompute, each run's
 * authoritative result for every key it processed); `"merge"` overlays only the given keys onto
 * whatever is currently recorded, leaving every other key untouched (a single-key patch, as
 * `retranslateEntry` makes).
 */
export type LockLocalePatch =
  | { readonly mode: "replace"; readonly entries: LockEntries }
  | { readonly mode: "merge"; readonly entries: LockEntries };

function applyLockLocalePatch(
  currentEntries: LockEntries | undefined,
  patch: LockLocalePatch,
): LockEntries {
  if (patch.mode === "replace") {
    return patch.entries;
  }
  return { ...currentEntries, ...patch.entries };
}

/**
 * Read-modify-write the lock-file's entries for exactly one locale.
 *
 * Performs no per-locale content locking of its own: mutual exclusion between two writers for the
 * *same* locale (another CLI `translate`/`watch` run, a workbook import, or a Studio write, in this
 * process or another) is the caller's responsibility. Every caller must invoke this only from
 * inside a `withLocaleWriteLock(cwd, locale, fs, ...)` callback held for that same `locale`,
 * covering this call and everything else touching that locale's target file in the same critical
 * section; see `locale-write-lock.ts`.
 *
 * It does, however, guard its own read-modify-write step with {@link withLockFileGuard}: the
 * physical lock-file is one shared resource every locale's critical section eventually writes to,
 * and two *different* locales are, by design, allowed to hold their own `withLocaleWriteLock` at
 * the same time, so without this second, much shorter-lived lock two concurrently-running locales
 * could still race on the one file underneath their otherwise-disjoint subtrees.
 *
 * @param cwd - Directory the lock-file resolves against.
 * @param fs - The file system seam.
 * @param locale - The locale whose entries this call updates.
 * @param patch - How to fold the caller's computed entries into the locale's current entries; see
 *   {@link LockLocalePatch}.
 * @returns The lock-file as written.
 * @throws {@link SdkError} `LOCK_FILE_INVALID`: the lock-file is corrupt, oversized, or at an
 *   unsupported version.
 * @throws {@link SdkError} `LOCK_CONTENDED`: the internal lock-file guard could not be acquired
 *   before its timeout (see {@link withLockFileGuard}).
 */
export async function updateLockFileLocale(
  cwd: string,
  fs: SdkFs,
  locale: string,
  patch: LockLocalePatch,
): Promise<LockFile> {
  return withLockFileGuard(cwd, fs, async () => {
    const path = lockFilePath(cwd);
    const lock = parseLockFileRead(await fs.readFileBounded(path, MAX_LOCK_FILE_BYTES), path);
    const nextEntries = applyLockLocalePatch(lock.locales[locale], patch);
    const next = updateLockLocale(lock, locale, nextEntries);
    await fs.writeFile(path, serializeLockFile(next));
    return next;
  });
}
