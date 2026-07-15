import { contentHash } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";

/**
 * One locale file reduced to a content hash per key, taken at one point in time. Carries no value
 * or key name past this snapshot itself; a caller (Studio's watcher, for the live-refresh signal)
 * only ever reports counts derived from comparing two of these, never the hashes or keys directly.
 */
export interface LocaleFileSnapshot {
  /** The locale this snapshot was read for (the configured source locale or a target locale). */
  readonly locale: string;
  /** Content hash per key, from core's `contentHash`. */
  readonly hashes: ReadonlyMap<string, string>;
}

/** Input for {@link readLocaleFileSnapshot}: the validated config and which locale to snapshot. */
export interface ReadLocaleFileSnapshotInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** The locale to snapshot: the configured source locale or any configured target locale. */
  readonly locale: string;
  /** Directory the file pattern resolves against; defaults to cwd. */
  readonly cwd?: string;
}

/** Composition seam for {@link readLocaleFileSnapshot}: inject a registry and a file system for tests. */
export interface ReadLocaleFileSnapshotDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/**
 * Read one locale file through the configured adapter and reduce it to a content hash per key.
 * Reuses the same tolerant read path {@link readTarget} already gives a target locale file: a file
 * that does not exist yet reads as an empty snapshot rather than throwing, so a caller can establish
 * a baseline before a locale's first write (or before Studio's own startup has ever seen the file).
 *
 * @param input - The validated config, the locale to snapshot, and the directory to resolve against.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns The locale's per-key content hash snapshot.
 * @throws {@link SdkError} `UNKNOWN_FORMAT` when the configured format has no registered adapter;
 *   rejects with the adapter's own error when the file exists but its content is malformed.
 */
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

/** A locale file's added, changed, and removed key counts between two of its own snapshots. Counts only, never key names. */
export interface LocaleSnapshotDelta {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
}

/**
 * Compare two snapshots of the same locale file, taken at different points in time, and count how
 * many keys look added, changed, or removed. A direct key-to-hash comparison rather than core's
 * `diffResources`: that function's source/target/baseline shape exists for cross-resource
 * comparison, and forcing a same-file, two-points-in-time comparison through it would need a
 * confusing relabeling (missing becomes removed, orphaned becomes added). This is not a new
 * comparison algorithm, only a direct comparison of two maps of hashes already produced by core's
 * `contentHash`.
 *
 * @param previous - The earlier snapshot of the file.
 * @param current - The later snapshot of the same file.
 * @returns The counts of keys added, changed, and removed between the two snapshots.
 */
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
