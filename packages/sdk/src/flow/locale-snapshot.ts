import { contentHash } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";

export interface LocaleFileSnapshot {
  readonly locale: string;
  readonly hashes: ReadonlyMap<string, string>;
}

export interface ReadLocaleFileSnapshotInput {
  readonly config: VerbatraConfig;
  readonly locale: string;
  readonly cwd?: string;
}

export interface ReadLocaleFileSnapshotDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

export async function readLocaleFileSnapshot(
  input: ReadLocaleFileSnapshotInput,
  deps: ReadLocaleFileSnapshotDeps = {},
): Promise<LocaleFileSnapshot> {
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(input.config.format, deps.adapterRegistry);
  const resource = await readTarget(cwd, input.config, adapter, fs, input.locale);
  const hashes = new Map<string, string>();
  for (const [key, entry] of resource.entries) {
    hashes.set(key, contentHash(entry));
  }
  return { locale: input.locale, hashes };
}

export interface LocaleSnapshotDelta {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
}

export function diffLocaleSnapshots(
  previous: LocaleFileSnapshot,
  current: LocaleFileSnapshot,
): LocaleSnapshotDelta {
  let added = 0;
  let changed = 0;
  for (const [key, hash] of current.hashes) {
    const previousHash = previous.hashes.get(key);
    if (previousHash === undefined) {
      added += 1;
    } else if (previousHash !== hash) {
      changed += 1;
    }
  }
  let removed = 0;
  for (const key of previous.hashes.keys()) {
    if (!current.hashes.has(key)) {
      removed += 1;
    }
  }
  return { added, changed, removed };
}
