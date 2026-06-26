import type { DiffResult } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import type { SdkFs } from "../fs.js";
import { diffLocales } from "./diff-locales.js";

/** Per-locale drift status: counts only, no key lists. */
export interface LocaleCheckSummary {
  /** The target locale this entry reports on. */
  readonly locale: string;
  /** `diff.missing.length`: keys present in source but absent from the target. */
  readonly missing: number;
  /** `diff.changed.length`: keys whose source changed since the target was last translated. */
  readonly stale: number;
  /** `diff.unchanged.length`: keys whose recorded baseline still matches the source. */
  readonly upToDate: number;
  /** `missing === 0 && stale === 0`: nothing needs (re)translating for this locale. */
  readonly inSync: boolean;
}

/** The aggregate read-only status across all checked target locales. */
export interface CheckSummary {
  /** AND of every locale's `inSync`; true exactly when the command exits 0. */
  readonly inSync: boolean;
  /** One entry per checked target locale, in config order. */
  readonly locales: readonly LocaleCheckSummary[];
}

/** Input for {@link check}: the validated config and which locales to check. */
export interface CheckInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Subset of target locales to check; defaults to all configured target locales. */
  readonly locales?: readonly string[];
}

/** Composition seam for {@link check}: inject a registry and a file system for tests. */
export interface CheckDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/** Project one raw per-locale diff to a counts-only per-locale status. */
function toCheckSummary(locale: string, diff: DiffResult): LocaleCheckSummary {
  return {
    locale,
    missing: diff.missing.length,
    stale: diff.changed.length,
    upToDate: diff.unchanged.length,
    inSync: diff.missing.length === 0 && diff.changed.length === 0,
  };
}

/**
 * Report which keys are missing or stale per target locale, without calling a provider, writing any
 * file, or touching the lock. Reuses the shared {@link diffLocales} read-plus-diff orchestration (the
 * same source read, adapter selection, and lock baseline the translate and export flows use), then maps
 * each raw `DiffResult` to counts only (missing, stale, up-to-date). `inSync` for a locale means nothing
 * is missing and nothing is stale; the top-level `inSync` is the AND across all checked locales. Orphaned
 * keys and integrity are ignored by design: they concern a write, which `check` never performs.
 *
 * @param input - The validated config and which locales to check.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns The aggregate and per-locale drift status.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`, `LOCK_FILE_INVALID`
 *   with the same meanings as in `translate`.
 */
export async function check(input: CheckInput, deps: CheckDeps = {}): Promise<CheckSummary> {
  const results = await diffLocales(input, deps);
  const locales = results.map(({ locale, diff }) => toCheckSummary(locale, diff));
  return { inSync: locales.every((entry) => entry.inSync), locales };
}
