import { type DiffResult, diffResources } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { baselineFor, lockFilePath, readLockFile } from "../lock/lock-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

export interface LockLocaleState {
  readonly locale: string;
  readonly keyCount: number;
  readonly missing: number;
  readonly stale: number;
  readonly upToDate: number;
}

export type LockStateResult =
  | { readonly exists: false }
  | {
      readonly exists: true;
      readonly version: number;
      readonly locales: readonly LockLocaleState[];
    };

export interface LockStateInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly locales?: readonly string[];
}

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
