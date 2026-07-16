import { type DiffResult, diffResources, type LocaleResource } from "@verbatra/core";
import type { AdapterRegistry, FormatAdapter } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../lock/lock-file.js";
import { localeFilePath } from "../paths.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

/** A target locale paired with its core diff against the source. */
export interface LocaleDiffResult {
  readonly locale: string;
  readonly diff: DiffResult;
}

/** Input for {@link diffLocales}: the validated config and which locales to diff. */
export interface DiffLocalesInput {
  readonly config: VerbatraConfig;
  /** Directory the pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** Subset of target locales to diff; defaults to all configured. */
  readonly locales?: readonly string[];
}

/** Composition seam for {@link diffLocales}: inject a registry and a file system for tests. */
export interface DiffLocalesDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/** Reads a locale's existing target resource, or an empty resource when the file does not exist. */
export async function readTarget(
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

/**
 * Reads the source, the lock baseline, and each selected target locale, then runs core's
 * `diffResources` per locale. Reads only: it calls no provider, writes no file, and never mutates
 * the lock. The shared read half of {@link check}, {@link diff}, and their siblings.
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
    selectLocales(config, input.locales).map(async (locale) => {
      const target = await readTarget(cwd, config, adapter, fs, locale);
      const diff = diffResources(source.resource, target, { baseline: baselineFor(lock, locale) });
      return { locale, diff };
    }),
  );
}
