import { contentHash } from "../hash/content-hash.js";
import type { LocaleResource } from "../model/locale-resource.js";
import type { TranslationEntry } from "../model/translation-entry.js";
import type { DiffOptions, DiffResult } from "./types.js";

function sorted(keys: Iterable<string>): readonly string[] {
  return [...keys].sort();
}

function isStale(
  key: string,
  sourceEntry: TranslationEntry,
  baseline: ReadonlyMap<string, string> | undefined,
): boolean {
  const previousHash = baseline?.get(key);
  if (previousHash === undefined) {
    return false;
  }
  return contentHash(sourceEntry) !== previousHash;
}

/**
 * Diff a source resource against a target resource, partitioning keys into missing, changed (stale),
 * orphaned, and unchanged. Inputs are never mutated, and it does not throw. Stale detection requires
 * `options.baseline`; without it, keys present in both are reported as unchanged.
 *
 * @param source - The resource translations are derived from.
 * @param target - The resource being compared against the source.
 * @param options - Diff options; `baseline` enables stale detection.
 * @returns The partition of keys into missing, changed, orphaned, and unchanged (each sorted).
 * @example
 * ```ts
 * const result = diffResources(source, target, { baseline });
 * // result.missing, result.changed, result.orphaned, result.unchanged
 * ```
 */
export function diffResources(
  source: LocaleResource,
  target: LocaleResource,
  options: DiffOptions = {},
): DiffResult {
  const missing: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const orphaned: string[] = [];

  for (const [key, sourceEntry] of source.entries) {
    if (!target.entries.has(key)) {
      missing.push(key);
    } else if (isStale(key, sourceEntry, options.baseline)) {
      changed.push(key);
    } else {
      unchanged.push(key);
    }
  }

  for (const key of target.entries.keys()) {
    if (!source.entries.has(key)) {
      orphaned.push(key);
    }
  }

  return {
    missing: sorted(missing),
    changed: sorted(changed),
    orphaned: sorted(orphaned),
    unchanged: sorted(unchanged),
  };
}
