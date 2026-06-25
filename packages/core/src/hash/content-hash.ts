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
 * Normalize a text field so content that is equal in meaning hashes equal in bytes:
 * Unicode to NFC (precomposed and decomposed forms of the same grapheme agree, for
 * example "e" + combining acute vs the single "é") and line endings to LF (a CRLF/LF
 * flip from an editor or a git autocrlf checkout is not a content change).
 */
function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n");
}

/**
 * Canonical, order-independent encoding of the fields that define an entry's
 * translatable content. Identity (key, namespace) is excluded by design: a
 * changed key is a missing/orphaned event, not a content change. Text fields are
 * normalized (see {@link normalizeText}) so equivalent content is encoded identically.
 */
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
 * Stable per-entry content hash for cheap change detection. Equal content yields
 * the same hash; different content yields a different hash; placeholder order
 * does not affect the result. Equivalence is taken up to Unicode NFC and LF line
 * endings, so a normalization or CRLF/LF flip is not reported as a content change.
 * Pure computation: it does not throw.
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
