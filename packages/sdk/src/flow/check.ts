import type { DiffResult } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import type { SdkFs } from "../fs.js";
import { diffLocales } from "./diff-locales.js";

/** One locale's counts in a {@link CheckSummary}. */
export interface LocaleCheckSummary {
  /** The target locale these counts describe. */
  readonly locale: string;
  /** Number of source keys with no translation in this locale yet. */
  readonly missing: number;
  /** Number of keys whose source text changed since the locale was last translated. */
  readonly stale: number;
  /** Number of keys whose translation still matches the source recorded in the lock-file. */
  readonly upToDate: number;
  /** True when this locale has nothing missing and nothing stale. */
  readonly inSync: boolean;
}

/** The result of {@link check}: per-locale counts plus one project-wide verdict. */
export interface CheckSummary {
  /** True only when every reported locale is in sync. This is the value a CI gate should assert on. */
  readonly inSync: boolean;
  /** Per-locale counts, in configured target order. */
  readonly locales: readonly LocaleCheckSummary[];
}

/** Input for {@link check}. */
export interface CheckInput {
  /** The resolved project config, normally from {@link loadConfig}. */
  readonly config: VerbatraConfig;
  /** Directory the `files.pattern` is resolved against. Defaults to the process working directory. */
  readonly cwd?: string;
  /** Restrict the report to these target locales. Defaults to every configured target locale. */
  readonly locales?: readonly string[];
}

/** Injectable dependencies for {@link check}. Every field has a working default. */
export interface CheckDeps {
  /** Format-adapter registry to resolve the configured format. Defaults to the built-in registry. */
  readonly adapterRegistry?: AdapterRegistry;
  /** File-system port. Defaults to the real file system. */
  readonly fs?: SdkFs;
}

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
 * Reports whether every target locale is up to date, without writing anything and without calling
 * the provider. This is the CI gate: run it on a pull request and fail the build when
 * {@link CheckSummary.inSync} is false.
 *
 * Staleness is judged against the lock-file baseline, not against the target file's mere existence,
 * so a key whose source text changed after it was translated counts as stale even though a
 * translation is present. A locale file that does not exist yet is treated as empty rather than as
 * an error, so a newly added locale reports every key as missing.
 *
 * Use {@link diff} instead when you need the key names rather than the counts.
 *
 * @param input - The config and the optional locale filter.
 * @param deps - Optional adapter registry and file-system overrides.
 * @returns Per-locale counts and the project-wide in-sync verdict.
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
export async function check(input: CheckInput, deps: CheckDeps = {}): Promise<CheckSummary> {
  const results = await diffLocales(input, deps);
  const locales = results.map(({ locale, diff }) => toCheckSummary(locale, diff));
  return { inSync: locales.every((entry) => entry.inSync), locales };
}
