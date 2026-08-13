import type { TranslationEntry } from "@verbatra/core";
import type { ValidatedRequestData } from "../provider.js";

interface ItemPayload {
  readonly key: string;
  readonly value: string;
  readonly description?: string;
  readonly meaning?: string;
}

function toItem(entry: TranslationEntry): ItemPayload {
  return {
    key: entry.key,
    value: entry.value,
    ...(entry.description !== undefined ? { description: entry.description } : {}),
    ...(entry.meaning !== undefined ? { meaning: entry.meaning } : {}),
  };
}

export function buildDataPayload(data: ValidatedRequestData): Record<string, unknown> {
  return {
    sourceLocale: data.sourceLocale,
    targetLocale: data.targetLocale,
    ...(data.tone !== undefined ? { tone: data.tone } : {}),
    ...(data.glossary !== undefined ? { glossary: data.glossary } : {}),
    items: data.entries.map(toItem),
  };
}
