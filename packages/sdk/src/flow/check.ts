import type { DiffResult } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import type { SdkFs } from "../fs.js";
import { diffLocales } from "./diff-locales.js";

export interface LocaleCheckSummary {
  readonly locale: string;
  readonly missing: number;
  readonly stale: number;
  readonly upToDate: number;
  readonly inSync: boolean;
}

export interface CheckSummary {
  readonly inSync: boolean;
  readonly locales: readonly LocaleCheckSummary[];
}

export interface CheckInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly locales?: readonly string[];
}

export interface CheckDeps {
  readonly adapterRegistry?: AdapterRegistry;
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

export async function check(input: CheckInput, deps: CheckDeps = {}): Promise<CheckSummary> {
  const results = await diffLocales(input, deps);
  const locales = results.map(({ locale, diff }) => toCheckSummary(locale, diff));
  return { inSync: locales.every((entry) => entry.inSync), locales };
}
