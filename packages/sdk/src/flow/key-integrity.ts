import {
  checkPlaceholders,
  diffResources,
  type LocaleResource,
  type TranslationEntry,
} from "@verbatra/core";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { createLocalePathResolver } from "../locale-path/resolver.js";
import { baselineFor, lockFilePath, readLockFile } from "../lock/lock-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTargetResource } from "./read-target.js";
import { selectLocales } from "./select-locales.js";
import { readSourceResource } from "./source.js";

export interface KeyIntegrityEntry {
  readonly key: string;
  readonly hasPlaceholders: boolean;
  readonly matches: boolean;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly icuValid: boolean;
}

export interface LocaleKeyIntegrity {
  readonly locale: string;
  readonly entries: readonly KeyIntegrityEntry[];
}

export interface KeyIntegrityInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly locales?: readonly string[];
  readonly keys?: readonly string[];
}

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

export async function keyIntegrity(
  input: KeyIntegrityInput,
  deps: KeyIntegrityDeps = {},
): Promise<readonly LocaleKeyIntegrity[]> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);
  const resolver = createLocalePathResolver(cwd, config);

  const source = await readSourceResource(config, resolver, fs, adapter);
  const lock = await readLockFile(lockFilePath(cwd), fs);

  return Promise.all(
    selectLocales(config, input.locales).map(async (locale) => {
      const target = await readTargetResource({
        resolver,
        format: config.format,
        locale,
        adapter,
        fs,
      });
      const diffResult = diffResources(source.resource, target, {
        baseline: baselineFor(lock, locale),
      });
      const changedKeys = selectChangedKeys(diffResult.changed, input.keys);
      const entries = integrityEntriesFor(source.resource, target, adapter, changedKeys);
      return { locale, entries };
    }),
  );
}
