import type { TranslationEntry } from "@verbatra/core";
import type { ValidatedRequestData } from "../provider.js";

/** A single item in the data payload. Untrusted `value` plus trusted metadata. */
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

/**
 * Assemble the structured data channel for an LLM request: locales, optional tone
 * and glossary, and the untrusted items. This object is what providers serialize
 * into their user turn. Nothing here is ever spliced into an instruction string;
 * that separation is the prompt-injection boundary, owned by the shared layer.
 */
export function buildDataPayload(data: ValidatedRequestData): Record<string, unknown> {
  return {
    sourceLocale: data.sourceLocale,
    targetLocale: data.targetLocale,
    ...(data.tone !== undefined ? { tone: data.tone } : {}),
    ...(data.glossary !== undefined ? { glossary: data.glossary } : {}),
    items: data.entries.map(toItem),
  };
}
