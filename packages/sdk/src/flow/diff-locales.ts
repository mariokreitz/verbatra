import { type DiffResult, diffResources, type LocaleResource } from "@verbatra/core";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../lock/lock-file.js";
import { localeFilePath } from "../paths.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readSource } from "./source.js";

/** A target locale paired with its core diff against the source. */
export interface LocaleDiffResult {
  readonly locale: string;
  readonly diff: DiffResult;
}

export interface DiffLocalesInput {
  readonly config: VerbatraConfig;
  /** Directory the pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Subset of target locales to diff; defaults to all configured. */
  readonly locales?: readonly string[];
}

export interface DiffLocalesDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/** Read a locale's existing target resource, or an empty resource when the file does not exist. */
async function readTarget(
  cwd: string,
  config: VerbatraConfig,
  adapter: FormatAdapter,
  fs: SdkFs,
  locale: string,
): Promise<LocaleResource> {
  const path = localeFilePath(cwd, config.files.pattern, locale);
  if (!(await fs.fileExists(path))) {
    return { locale, namespace: "", format: config.format, entries: new Map() };
  }
  return (await adapter.read(path, locale)).resource;
}

/** Resolve which target locales to diff: all configured ones, or the requested subset in config order. */
function selectedLocales(config: VerbatraConfig, requested?: readonly string[]): readonly string[] {
  if (requested === undefined) {
    return config.targetLocales;
  }
  const wanted = new Set(requested);
  // Preserve config order; silently ignore a requested locale that is not configured.
  return config.targetLocales.filter((locale) => wanted.has(locale));
}

/**
 * Read the source, the lock baseline, and each selected target locale, then run core's `diffResources`
 * per locale. Reads only: it calls no provider, writes no file, and never mutates the lock.
 */
export async function diffLocales(
  input: DiffLocalesInput,
  deps: DiffLocalesDeps = {},
): Promise<readonly LocaleDiffResult[]> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);

  const source = await readSource(config, cwd, fs, adapter);
  const lock = await readLockFile(lockFilePath(cwd), fs);

  return Promise.all(
    selectedLocales(config, input.locales).map(async (locale) => {
      const target = await readTarget(cwd, config, adapter, fs, locale);
      const diff = diffResources(source.resource, target, { baseline: baselineFor(lock, locale) });
      return { locale, diff };
    }),
  );
}
