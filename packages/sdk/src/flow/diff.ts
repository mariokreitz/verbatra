import type { DiffResult } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import type { SdkFs } from "../fs.js";
import { diffLocales } from "./diff-locales.js";

/** One locale's pending work in a {@link DiffSummary}, as key names rather than counts. */
export interface LocaleDiff {
  /** The target locale this entry describes. */
  readonly locale: string;
  /** Keys present in the source but absent from this locale. */
  readonly missing: readonly string[];
  /** Keys whose source text changed since this locale was last translated. */
  readonly changed: readonly string[];
  /**
   * Keys present in this locale but no longer in the source. They are reported, never removed,
   * unless a run is asked to prune.
   */
  readonly orphaned: readonly string[];
  /**
   * True when this locale has missing or changed keys. Orphaned keys alone do not count as pending,
   * because they need no translation work.
   */
  readonly hasPendingChanges: boolean;
}

/** The result of {@link diff}: per-locale key lists plus one project-wide verdict. */
export interface DiffSummary {
  /** True when any locale has missing or changed keys. */
  readonly hasPendingChanges: boolean;
  /** Per-locale key lists, in configured target order. */
  readonly locales: readonly LocaleDiff[];
}

/** Input for {@link diff}. */
export interface DiffInput {
  /** The resolved project config, normally from {@link loadConfig}. */
  readonly config: VerbatraConfig;
  /** Directory the `files.pattern` is resolved against. Defaults to the process working directory. */
  readonly cwd?: string;
  /** Restrict the report to these target locales. Defaults to every configured target locale. */
  readonly locales?: readonly string[];
}

/** Injectable dependencies for {@link diff}. Every field has a working default. */
export interface DiffDeps {
  /** Format-adapter registry to resolve the configured format. Defaults to the built-in registry. */
  readonly adapterRegistry?: AdapterRegistry;
  /** File-system port. Defaults to the real file system. */
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
 * Reports the per-locale drift between the source and each target locale as key names, without
 * writing anything and without calling the provider. It answers "what exactly would a run change",
 * where {@link check} answers "is anything pending at all".
 *
 * The comparison runs against the lock-file baseline, so `changed` means the source text moved
 * since the key was last translated rather than merely that the two strings differ. Orphaned keys
 * are reported but never removed here; pruning happens only in {@link translate}.
 *
 * Note that a malformed target locale file surfaces the adapter's own error and code rather than a
 * wrapped {@link SdkError}, because only source reads are wrapped. Its message names the offending
 * locale and the resolved path. A caller that maps SDK codes should be ready for an unrecognized
 * error from a target file.
 *
 * @param input - The config and the optional locale filter.
 * @param deps - Optional adapter registry and file-system overrides.
 * @returns Per-locale missing, changed, and orphaned key lists.
 *
 * @throws {@link SdkError} `UNKNOWN_FORMAT`: no adapter is registered for the configured format.
 * @throws {@link SdkError} `LOCALE_LAYOUT_INVALID`: the `files.pattern` and `files.localeStyle`
 * cannot be combined, or a configured locale has no valid path spelling under that style.
 * @throws {@link SdkError} `LOCALE_PATH_COLLISION`: two configured locales resolve to the same path.
 * @throws {@link SdkError} `SOURCE_UNREADABLE`: the source locale file does not exist.
 * @throws {@link SdkError} `SOURCE_INVALID`: the source locale file could not be parsed.
 * @throws {@link SdkError} `LOCK_FILE_INVALID`: the lock-file is corrupt, oversized, or at an
 * unsupported version.
 * @throws {@link SdkError} `UNKNOWN_LOCALE`: a requested locale is not a configured target locale.
 */
export async function diff(input: DiffInput, deps: DiffDeps = {}): Promise<DiffSummary> {
  const results = await diffLocales(input, deps);
  const locales = results.map(({ locale, diff: result }) => toLocaleDiff(locale, result));
  return { hasPendingChanges: locales.some((entry) => entry.hasPendingChanges), locales };
}
