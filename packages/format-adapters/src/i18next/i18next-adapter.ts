import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import { AdapterError } from "../errors.js";
import { flattenTree } from "../json/flatten.js";
import { parseJsonObject } from "../json/json-tree.js";
import { MAX_INPUT_BYTES } from "../json/limits.js";
import { unflattenEntries } from "../json/unflatten.js";
import { extractI18nextPlaceholders } from "./placeholders.js";
import { isPluralKey } from "./plural.js";

const FORMAT: SupportedFormat = "i18next-json";

function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
}

function canHandle(filePath: string, sample?: string): boolean {
  if (extname(filePath).toLowerCase() !== ".json") {
    return false;
  }
  return sample === undefined || sample.trimStart().startsWith("{");
}

/**
 * Parse and flatten untrusted content into entries, guaranteeing that any failure
 * surfaces as a structured AdapterError rather than escaping raw.
 */
function deriveEntry(
  key: string,
  value: string,
): {
  readonly placeholders: readonly string[];
  readonly isPlural: boolean;
} {
  return { placeholders: extractI18nextPlaceholders(value), isPlural: isPluralKey(key) };
}

function toEntries(content: string, namespace: string): Map<string, TranslationEntry> {
  try {
    const tree = parseJsonObject(content);
    return flattenTree(tree, namespace, deriveEntry);
  } catch (error) {
    if (error instanceof AdapterError) {
      throw error;
    }
    throw new AdapterError("INVALID_STRUCTURE", "The file could not be read as i18next JSON.");
  }
}

/**
 * The i18next JSON adapter. i18next interpolation is not ICU, so invalidIcuKeys is
 * always empty here; ICU determination arrives with the next-intl adapter.
 */
export function createI18nextJsonAdapter(): FormatAdapter {
  return {
    format: FORMAT,
    canHandle,
    extractPlaceholders: extractI18nextPlaceholders,
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
