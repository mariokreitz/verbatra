import type { DiffResult } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import type { SdkFs } from "../fs.js";
import { diffLocales } from "./diff-locales.js";

/** Per-locale pending change: the key lists, not counts. */
export interface LocaleDiff {
  /** The target locale this entry reports on. */
  readonly locale: string;
  /** Keys present in source but absent from the target; would be added by a run. */
  readonly missing: readonly string[];
  /** Keys whose source changed since last translated; would be re-translated. */
  readonly changed: readonly string[];
  /** Keys present in target but absent from source; report-only, never pending. */
  readonly orphaned: readonly string[];
  /** True when the locale has missing or changed keys; orphaned keys do not count. */
  readonly hasPendingChanges: boolean;
}

/** The aggregate read-only diff across all checked target locales. */
export interface DiffSummary {
  /** True when any checked locale has pending changes. */
  readonly hasPendingChanges: boolean;
  /** One entry per checked target locale, in config order. */
  readonly locales: readonly LocaleDiff[];
}

/** Input for {@link diff}: the validated config and which locales to diff. */
export interface DiffInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Subset of target locales to diff; defaults to all configured target locales. */
  readonly locales?: readonly string[];
}

/** Composition seam for {@link diff}: inject a registry and a file system for tests. */
export interface DiffDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

function toLocaleDiff(locale: string, diff: DiffResult): LocaleDiff {
  return {
    locale,
    missing: diff.missing,
    changed: diff.changed,
    orphaned: diff.orphaned,
    hasPendingChanges: diff.missing.length > 0 || diff.changed.length > 0,
  };
}

/**
 * Reports the exact pending change per target locale as three key lists (missing, changed,
 * orphaned), without calling a provider, writing any file, or touching the lock. The detailed
 * sibling of {@link check}. A locale's `hasPendingChanges` is driven by missing or changed only;
 * orphaned keys are reported but do not flip it, since a default `translate` run does not prune.
 * The top-level `hasPendingChanges` is true when any checked locale has pending changes.
 *
 * @param input - The validated config and which locales to diff.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns The aggregate and per-locale pending change.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`, `LOCK_FILE_INVALID`
 *   with the same meanings as in `translate`, or `UNKNOWN_LOCALE` when a requested locale is not
 *   among the configured target locales.
 */
export async function diff(input: DiffInput, deps: DiffDeps = {}): Promise<DiffSummary> {
  const results = await diffLocales(input, deps);
  const locales = results.map(({ locale, diff: result }) => toLocaleDiff(locale, result));
  return { hasPendingChanges: locales.some((entry) => entry.hasPendingChanges), locales };
}
