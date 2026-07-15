import {
  checkPlaceholders,
  diffResources,
  type LocaleResource,
  type TranslationEntry,
} from "@verbatra/core";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../lock/lock-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

/**
 * One key's placeholder or ICU integrity result for one target locale. Only ever computed for a
 * "changed" key (a current source and a current target value both exist); `hasPlaceholders` is
 * false when the source value carries no placeholders at all, in which case `matches` is
 * trivially true and carries no meaningful signal on its own. `icuValid` is computed
 * unconditionally, independent of `matches`: unlike `gateCandidateValue` (a decision function that
 * may stop at the first failing check), this is an information report and must stay accurate even
 * when the key already fails on placeholders. Always true for a non-ICU format, by construction of
 * `adapter.validateMessage`. Carries no source or target string value: only the boolean results
 * and, on a placeholder mismatch, the specific tokens involved.
 */
export interface KeyIntegrityEntry {
  readonly key: string;
  readonly hasPlaceholders: boolean;
  readonly matches: boolean;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly icuValid: boolean;
}

/** One target locale's integrity entries for the keys checked against it. */
export interface LocaleKeyIntegrity {
  readonly locale: string;
  readonly entries: readonly KeyIntegrityEntry[];
}

/** Input for {@link keyIntegrity}: the validated config, which locales to check, and an optional key filter. */
export interface KeyIntegrityInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Subset of target locales to check; defaults to all configured target locales. */
  readonly locales?: readonly string[];
  /** Restrict the check to these keys; only the ones that are "changed" for a locale are checked. Defaults to every changed key. */
  readonly keys?: readonly string[];
}

/** Composition seam for {@link keyIntegrity}: inject a registry and a file system for tests. */
export interface KeyIntegrityDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

function checkEntryIntegrity(
  adapter: FormatAdapter,
  sourceEntry: TranslationEntry,
  targetEntry: TranslationEntry,
): KeyIntegrityEntry {
  const result =
    adapter.comparePlaceholders?.(sourceEntry.value, targetEntry.value) ??
    checkPlaceholders(sourceEntry.placeholders, targetEntry.placeholders);
  return {
    key: sourceEntry.key,
    hasPlaceholders: sourceEntry.placeholders.length > 0,
    matches: result.matches,
    missing: result.missing,
    extra: result.extra,
    icuValid: adapter.validateMessage(targetEntry.value),
  };
}

function selectChangedKeys(
  changed: readonly string[],
  requested: readonly string[] | undefined,
): readonly string[] {
  if (requested === undefined) {
    return changed;
  }
  const wanted = new Set(requested);
  return changed.filter((key) => wanted.has(key));
}

function integrityEntriesFor(
  source: LocaleResource,
  target: LocaleResource,
  adapter: FormatAdapter,
  changedKeys: readonly string[],
): readonly KeyIntegrityEntry[] {
  const entries: KeyIntegrityEntry[] = [];
  for (const key of changedKeys) {
    const sourceEntry = source.entries.get(key);
    const targetEntry = target.entries.get(key);
    /* v8 ignore next 3 -- diffResources only reports a key as "changed" when it exists in both
       the source and the target resource, so this branch is unreachable by construction. */
    if (sourceEntry === undefined || targetEntry === undefined) {
      continue;
    }
    entries.push(checkEntryIntegrity(adapter, sourceEntry, targetEntry));
  }
  return entries;
}

/**
 * For each selected target locale's "changed" keys (present with a current value on both sides,
 * per core's `diffResources`), run the placeholder check and the ICU message-validity check and
 * report a per-key result. Reuses `checkPlaceholders` (`@verbatra/core`) directly, and an
 * adapter's own `comparePlaceholders` when present (the branch-aware ICU path), exactly as they
 * exist today; it does not reimplement either. `icuValid` is `adapter.validateMessage(target)`,
 * computed unconditionally and independently of the placeholder result, so a target that is
 * placeholder-valid but syntactically invalid ICU is still reported accurately. Read-only: it
 * calls no provider, writes no file, and never touches the lock. "Missing" and "orphaned" keys are
 * never checked, since one side's value does not exist for those.
 *
 * The returned entries never carry a source or target string value, only the boolean results and,
 * on a placeholder mismatch, the specific tokens involved.
 *
 * @param input - The validated config, which locales to check, and an optional key filter.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns One entry per checked locale, each carrying the integrity result for its changed keys
 *   (narrowed to `input.keys` when supplied).
 * @throws {@link SdkError} `UNKNOWN_FORMAT`, `SOURCE_UNREADABLE`, `SOURCE_INVALID`,
 *   `LOCK_FILE_INVALID`, or `UNKNOWN_LOCALE`, with the same meanings as in {@link diff}.
 */
export async function keyIntegrity(
  input: KeyIntegrityInput,
  deps: KeyIntegrityDeps = {},
): Promise<readonly LocaleKeyIntegrity[]> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);

  const source = await readSource(config, cwd, fs, adapter);
  const lock = await readLockFile(lockFilePath(cwd), fs);

  return Promise.all(
    selectLocales(config, input.locales).map(async (locale) => {
      const target = await readTarget(cwd, config, adapter, fs, locale);
      const diffResult = diffResources(source.resource, target, {
        baseline: baselineFor(lock, locale),
      });
      const changedKeys = selectChangedKeys(diffResult.changed, input.keys);
      const entries = integrityEntriesFor(source.resource, target, adapter, changedKeys);
      return { locale, entries };
    }),
  );
}
