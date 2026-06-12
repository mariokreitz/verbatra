import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import { AdapterError } from "../errors.js";
import { flattenTree } from "../json/flatten.js";
import { parseJsonObject } from "../json/json-tree.js";
import { MAX_INPUT_BYTES } from "../json/limits.js";
import { unflattenEntries } from "../json/unflatten.js";
import { extractVueI18nPlaceholders } from "./placeholders.js";
import { isPluralValue } from "./plural.js";

const FORMAT: SupportedFormat = "vue-i18n-json";

function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
}

function canHandle(filePath: string, sample?: string): boolean {
  if (extname(filePath).toLowerCase() !== ".json") {
    return false;
  }
  return sample === undefined || sample.trimStart().startsWith("{");
}

// isPlural is decided from the value (pipe), so the key is unused.
function deriveEntry(
  _key: string,
  value: string,
): {
  readonly placeholders: readonly string[];
  readonly isPlural: boolean;
} {
  return { placeholders: extractVueI18nPlaceholders(value), isPlural: isPluralValue(value) };
}

function toEntries(content: string, namespace: string): Map<string, TranslationEntry> {
  try {
    const tree = parseJsonObject(content);
    return flattenTree(tree, namespace, deriveEntry);
  } catch (error) {
    if (error instanceof AdapterError) {
      throw error;
    }
    throw new AdapterError("INVALID_STRUCTURE", "The file could not be read as vue-i18n JSON.");
  }
}

/**
 * The vue-i18n JSON adapter. vue-i18n is not ICU-based, so invalidIcuKeys is always
 * empty. Pipe-separated plural values are kept verbatim as a single entry; the value
 * is never split into forms.
 */
export function createVueI18nJsonAdapter(): FormatAdapter {
  return {
    format: FORMAT,
    canHandle,
    extractPlaceholders: extractVueI18nPlaceholders,
    async read(filePath, locale): Promise<ReadResult> {
      const info = await stat(filePath);
      if (info.size > MAX_INPUT_BYTES) {
        throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
      }
      const content = await readFile(filePath, "utf8");
      const namespace = namespaceOf(filePath);
      const entries = toEntries(content, namespace);
      const resource: LocaleResource = { locale, namespace, format: FORMAT, entries };
      return { resource, invalidIcuKeys: [] };
    },
    async write(resource, filePath): Promise<void> {
      const root = unflattenEntries(resource.entries);
      const content = `${JSON.stringify(root, null, 2)}\n`;
      await writeFile(filePath, content, "utf8");
    },
  };
}
