import type { DiffResult } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import type { SdkFs } from "../fs.js";
import { diffLocales } from "./diff-locales.js";

export interface LocaleDiff {
  readonly locale: string;
  readonly missing: readonly string[];
  readonly changed: readonly string[];
  readonly orphaned: readonly string[];
  readonly hasPendingChanges: boolean;
}

export interface DiffSummary {
  readonly hasPendingChanges: boolean;
  readonly locales: readonly LocaleDiff[];
}

export interface DiffInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly locales?: readonly string[];
}

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

export async function diff(input: DiffInput, deps: DiffDeps = {}): Promise<DiffSummary> {
  const results = await diffLocales(input, deps);
  const locales = results.map(({ locale, diff: result }) => toLocaleDiff(locale, result));
  return { hasPendingChanges: locales.some((entry) => entry.hasPendingChanges), locales };
}
