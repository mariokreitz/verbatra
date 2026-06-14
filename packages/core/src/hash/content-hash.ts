import type { TranslationEntry } from "../model/translation-entry.js";

const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const U64_MASK = (1n << 64n) - 1n;

/**
 * Deterministic 64-bit FNV-1a hash of a string, returned as 16 hex chars.
 * Pure computation: same input always yields the same output, in any runtime.
 */
function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * FNV_PRIME) & U64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Canonical, order-independent encoding of the fields that define an entry's
 * translatable content. Identity (key, namespace) is excluded by design: a
 * changed key is a missing/orphaned event, not a content change.
 */
function canonicalize(entry: TranslationEntry): string {
  return JSON.stringify([
    entry.value,
    entry.description ?? null,
    entry.meaning ?? null,
    entry.isPlural,
    [...entry.placeholders].sort(),
  ]);
}

/**
 * Stable per-entry content hash for cheap change detection. Equal content yields
 * the same hash; different content yields a different hash; placeholder order
 * does not affect the result. Pure computation: it does not throw.
 *
 * @param entry - The entry whose translatable content is hashed. Identity (key, namespace) is
 *   excluded, so renaming a key does not change its hash.
 * @returns A 16-character lowercase hex digest.
 * @example
 * ```ts
 * const a = contentHash(entry);
 * const unchanged = contentHash(entry) === a; // true for identical content
 * ```
 */
export function contentHash(entry: TranslationEntry): string {
  return fnv1a64(canonicalize(entry));
}
