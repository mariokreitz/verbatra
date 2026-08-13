import type { TranslationEntry } from "../model/translation-entry.js";
import { stableStringHash } from "./string-hash.js";

function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n");
}

function canonicalize(entry: TranslationEntry): string {
  return JSON.stringify([
    normalizeText(entry.value),
    entry.description == null ? null : normalizeText(entry.description),
    entry.meaning == null ? null : normalizeText(entry.meaning),
    entry.isPlural,
    [...entry.placeholders].map(normalizeText).sort(),
  ]);
}

export function contentHash(entry: TranslationEntry): string {
  return stableStringHash(canonicalize(entry));
}
