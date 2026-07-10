import { resolve } from "node:path";
import { z } from "zod";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
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
 * Read the lock-file. A missing file degrades to an empty lock (first-run); a corrupt file or a
 * `version` other than {@link CURRENT_VERSION} is a structured error so it is never silently
 * overwritten or misinterpreted under the wrong version's semantics.
 */
export async function readLockFile(path: string, fs: SdkFs): Promise<LockFile> {
  const read = await fs.readFileBounded(path, MAX_LOCK_FILE_BYTES);
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
export async function writeLockFile(path: string, lock: LockFile, fs: SdkFs): Promise<void> {
  const locales: Record<string, Record<string, string>> = {};
  for (const [locale, entries] of Object.entries(lock.locales).sort(byKey)) {
    locales[locale] = sortRecord(entries);
  }
  const ordered = { version: lock.version, locales };
  await fs.writeFile(path, `${JSON.stringify(ordered, null, 2)}\n`);
}
