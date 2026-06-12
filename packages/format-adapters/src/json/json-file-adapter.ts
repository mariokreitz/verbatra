import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import { AdapterError } from "../errors.js";
import { type DeriveEntry, flattenTree } from "./flatten.js";
import { type JsonRecord, parseJsonObject } from "./json-tree.js";
import { MAX_INPUT_BYTES } from "./limits.js";
import { unflattenEntries } from "./unflatten.js";

/** Per-value placeholder extraction, exposed on the adapter for consumers. */
type ExtractPlaceholders = (value: string) => readonly string[];

/** Derives the keys whose values are invalid for the format's message syntax. */
type ComputeInvalidIcuKeys = (entries: ReadonlyMap<string, TranslationEntry>) => readonly string[];

/** Optional check on the parsed tree before flattening (for example, reject mixed structure). */
type ValidateTree = (tree: JsonRecord) => void;

/** Optional builder for the object to write, allowing formats to control on-disk structure. */
type BuildWriteTree = (
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
) => unknown | Promise<unknown>;

export interface JsonFileAdapterOptions {
  readonly format: SupportedFormat;
  readonly deriveEntry: DeriveEntry;
  readonly extractPlaceholders: ExtractPlaceholders;
  /** Optional; formats without ICU (i18next, vue-i18n) omit it and report none. */
  readonly computeInvalidIcuKeys?: ComputeInvalidIcuKeys;
  /** Optional; runs on the parsed tree before flattening (defaults to no check). */
  readonly validateTree?: ValidateTree;
  /** Optional; builds the object to write (defaults to nested via unflattenEntries). */
  readonly buildWriteTree?: BuildWriteTree;
}

function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
}

function canHandle(filePath: string, sample?: string): boolean {
  if (extname(filePath).toLowerCase() !== ".json") {
    return false;
  }
  return sample === undefined || sample.trimStart().startsWith("{");
}

function toEntries(
  content: string,
  namespace: string,
  deriveEntry: DeriveEntry,
  validateTree?: ValidateTree,
): Map<string, TranslationEntry> {
  try {
    const tree = parseJsonObject(content);
    validateTree?.(tree);
    return flattenTree(tree, namespace, deriveEntry);
  } catch (error) {
    if (error instanceof AdapterError) {
      throw error;
    }
    throw new AdapterError("INVALID_STRUCTURE", "The file could not be read as JSON.");
  }
}

/**
 * Build a JSON file adapter from format-specific behavior. All JSON adapters share
 * the same shell (detection, bounded read, structured errors, order-preserving
 * write); only placeholder/plural derivation and ICU validity differ.
 */
export function createJsonFileAdapter(options: JsonFileAdapterOptions): FormatAdapter {
  const {
    format,
    deriveEntry,
    extractPlaceholders,
    computeInvalidIcuKeys,
    validateTree,
    buildWriteTree,
  } = options;
  return {
    format,
    canHandle,
    extractPlaceholders,
    async read(filePath, locale): Promise<ReadResult> {
      const info = await stat(filePath);
      if (!info.isFile()) {
        throw new AdapterError("INVALID_STRUCTURE", "The path is not a regular file.");
      }
      if (info.size > MAX_INPUT_BYTES) {
        throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
      }
      const content = await readFile(filePath, "utf8");
      const namespace = namespaceOf(filePath);
      const entries = toEntries(content, namespace, deriveEntry, validateTree);
      const resource: LocaleResource = { locale, namespace, format, entries };
      const invalidIcuKeys = computeInvalidIcuKeys ? computeInvalidIcuKeys(entries) : [];
      return { resource, invalidIcuKeys };
    },
    async write(resource, filePath): Promise<void> {
      const tree = buildWriteTree
        ? await buildWriteTree(resource.entries, filePath)
        : unflattenEntries(resource.entries);
      await writeFile(filePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
    },
  };
}
