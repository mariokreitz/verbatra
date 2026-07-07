import { type DiffResult, diffResources } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../lock/lock-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

/** Per-locale key count and drift against the source and target files, from the recorded lock baseline. */
export interface LockLocaleState {
  /** The target locale this entry reports on. */
  readonly locale: string;
  /** Number of keys the lock records a baseline for, in this locale. */
  readonly keyCount: number;
  /** Keys present in source but absent from the target. */
  readonly missing: number;
  /** Keys whose source changed since the target was last translated. */
  readonly stale: number;
  /** Keys whose recorded baseline still matches the source. */
  readonly upToDate: number;
}

/**
 * The lock-file's existence, version, and per-locale drift. `exists` is the outcome of an explicit
 * probe of the lock-file path, never inferred from {@link readLockFile}'s missing-file degrade, so
 * "no lock-file yet" and "an empty but present lock-file" stay distinguishable.
 */
export type LockStateResult =
  | { readonly exists: false }
  | {
      readonly exists: true;
      readonly version: number;
      readonly locales: readonly LockLocaleState[];
    };

/** Input for {@link lockState}: the validated config and which locales to report on. */
export interface LockStateInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Subset of target locales to report on; defaults to all configured target locales. */
  readonly locales?: readonly string[];
}

/** Composition seam for {@link lockState}: inject a registry and a file system for tests. */
export interface LockStateDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

function toLockLocaleState(locale: string, keyCount: number, diff: DiffResult): LockLocaleState {
  return {
    locale,
    keyCount,
    missing: diff.missing.length,
    stale: diff.changed.length,
    upToDate: diff.unchanged.length,
  };
}

/**
 * Report the lock-file's existence, version, and per-locale drift (key count from the recorded
 * baseline, plus missing, stale, and up-to-date counts against the current source and target),
 * without calling a provider, writing any file, or mutating the lock. `exists` comes from an
 * explicit probe of the lock-file path: when it is absent, the result is `{ exists: false }` and
 * no source or target file is read, since there is no recorded baseline to report drift against.
 *
 * @param input - The validated config and which locales to report on.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns The lock-file's existence and, when present, its version and per-locale drift.
 * @throws {@link SdkError} `UNKNOWN_LOCALE` when a requested locale is not among the configured
 *   target locales; when the lock-file exists, also `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`,
 *   `SOURCE_INVALID`, or `LOCK_FILE_INVALID` with the same meanings as in `translate`.
 */
export async function lockState(
  input: LockStateInput,
  deps: LockStateDeps = {},
): Promise<LockStateResult> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const locales = selectLocales(config, input.locales);

  const path = lockFilePath(cwd);
  const exists = await fs.fileExists(path);
  if (!exists) {
    return { exists: false };
  }

  const lock = await readLockFile(path, fs);
  const adapter = selectAdapter(config.format, deps.adapterRegistry);
  const source = await readSource(config, cwd, fs, adapter);

  const localeStates = await Promise.all(
    locales.map(async (locale) => {
      const target = await readTarget(cwd, config, adapter, fs, locale);
      const baseline = baselineFor(lock, locale);
      const diff = diffResources(source.resource, target, { baseline });
      return toLockLocaleState(locale, baseline.size, diff);
    }),
  );

  return { exists: true, version: lock.version, locales: localeStates };
}
