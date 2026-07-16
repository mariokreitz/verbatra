import type { TranslationEntry } from "../model/translation-entry.js";

const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const U64_MASK = (1n << 64n) - 1n;

/** Deterministic 64-bit FNV-1a hash of a string, returned as 16 hex chars. */
function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * FNV_PRIME) & U64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Normalize so equivalent content hashes equal: Unicode to NFC and line endings to LF. */
function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n");
}

/** Canonical encoding of an entry's translatable fields; placeholders are sorted so their order cannot affect the hash, and identity (key, namespace) is excluded so a renamed key is a missing/orphaned event, not a content change. */
function canonicalize(entry: TranslationEntry): string {
  return JSON.stringify([
    normalizeText(entry.value),
    entry.description == null ? null : normalizeText(entry.description),
    entry.meaning == null ? null : normalizeText(entry.meaning),
    entry.isPlural,
    [...entry.placeholders].map(normalizeText).sort(),
  ]);
}

/**
 * Stable per-entry content hash for change detection: equal content hashes equal, placeholder order
 * is ignored, and equivalence holds up to Unicode NFC and LF line endings.
 *
 * @param entry - The entry whose translatable content is hashed; identity (key, namespace) is excluded.
 * @returns A 16-character lowercase hex digest.
 */
export function contentHash(entry: TranslationEntry): string {
  return fnv1a64(canonicalize(entry));
}
