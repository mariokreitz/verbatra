import type { LocaleResource } from "../model/locale-resource.js";
import type { SupportedFormat } from "../model/supported-format.js";
import type { TranslationEntry } from "../model/translation-entry.js";

/** Build a TranslationEntry with sensible defaults for tests. */
export function entry(overrides: Partial<TranslationEntry> & { key: string }): TranslationEntry {
  return {
    namespace: "common",
    value: `value for ${overrides.key}`,
    placeholders: [],
    isPlural: false,
    ...overrides,
  };
}

/** Build a LocaleResource from a list of entries, keyed by entry.key. */
export function resource(
  locale: string,
  entries: readonly TranslationEntry[],
  options: { namespace?: string; format?: SupportedFormat } = {},
): LocaleResource {
  const map = new Map<string, TranslationEntry>();
  for (const item of entries) {
    map.set(item.key, item);
  }
  return {
    locale,
    namespace: options.namespace ?? "common",
    format: options.format ?? "i18next-json",
    entries: map,
  };
}
