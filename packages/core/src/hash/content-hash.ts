import type { TranslationEntry } from "../model/translation-entry.js";
import { stableStringHash } from "./string-hash.js";

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
  return stableStringHash(canonicalize(entry));
}
