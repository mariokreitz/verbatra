import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import {
  buildCanHandle,
  computeIcu,
  namespaceOf,
  rethrowStructured,
  type Sniff,
} from "../shell.js";
import { atomicWriteFile } from "./atomic-write.js";
import { readFileContent } from "./bounded-read.js";
import { type DeriveEntry, flattenTree, type KeyMode } from "./flatten.js";
import type { JsonRecord } from "./json-tree.js";
import { unflattenEntries } from "./unflatten.js";

/** Per-value placeholder extraction, exposed on the adapter for consumers. */
type ExtractPlaceholders = (value: string) => readonly string[];

/** Derives the keys whose values are invalid for the format's message syntax. */
type ComputeInvalidIcuKeys = (entries: ReadonlyMap<string, TranslationEntry>) => readonly string[];

/** Validates a single value against the format's message syntax (one value, before write). */
type ValidateMessage = (value: string) => boolean;

/** Optional check on the parsed tree before flattening (for example, reject mixed structure). */
type ValidateTree = (tree: JsonRecord) => void;

/** Optional builder for the object to write, allowing formats to control on-disk structure. */
type BuildWriteTree = (
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
) => unknown | Promise<unknown>;

export interface TreeFileAdapterOptions {
  readonly format: SupportedFormat;
  /** Accepted file extensions, lower-cased and dot-prefixed (for example `[".yaml", ".yml"]`). */
  readonly extensions: readonly string[];
  /** Optional content sniff; with none, the extension match alone decides `canHandle`. */
  readonly sniff?: Sniff;
  /** Parse file content into a validated tree; throws a structured AdapterError on bad syntax or shape. */
  readonly parse: (content: string) => JsonRecord;
  /** Serialize the write tree to file content, owning the trailing-newline policy. */
  readonly serialize: (tree: unknown) => string;
  readonly deriveEntry: DeriveEntry;
  readonly extractPlaceholders: ExtractPlaceholders;
  /** Optional; formats without ICU (i18next, vue-i18n, YAML) omit it and report none. */
  readonly computeInvalidIcuKeys?: ComputeInvalidIcuKeys;
  /** Optional per-value validator; formats without ICU omit it and every value is valid. */
  readonly validateMessage?: ValidateMessage;
  /** Optional; runs on the parsed tree before flattening (defaults to no check). */
  readonly validateTree?: ValidateTree;
  /** Optional; builds the object to write (defaults to nested via unflattenEntries). */
  readonly buildWriteTree?: BuildWriteTree;
  /** Optional; how a dotted string key is interpreted (defaults to `literal-leaf`). */
  readonly keyMode?: KeyMode;
}

function toEntries(
  content: string,
  namespace: string,
  parse: (content: string) => JsonRecord,
  deriveEntry: DeriveEntry,
  keyMode: KeyMode,
  validateTree?: ValidateTree,
): Map<string, TranslationEntry> {
  try {
    const tree = parse(content);
    validateTree?.(tree);
    return flattenTree(tree, namespace, deriveEntry, keyMode);
  } catch (error) {
    rethrowStructured(error, "The file could not be parsed.");
  }
}

/**
 * Build a tree-file {@link FormatAdapter} from format-specific behavior. The shared shell every nested-tree
 * adapter (the JSON family, ARB, YAML) is built on: supply detection (`extensions` plus an optional
 * `sniff`), `parse` and `serialize`, and the per-leaf hooks, and the shell provides the bounded
 * TOCTOU-safe read, structured errors, the flatten/unflatten mapping, and the atomic write.
 *
 * @param options - The format-specific behavior.
 * @returns A ready-to-register `FormatAdapter`.
 * @throws {@link AdapterError} from `read` (the code `parse` throws, plus `INVALID_STRUCTURE`,
 *   `INPUT_TOO_LARGE`, or any `validateTree` error). A missing path rejects with the underlying
 *   filesystem error.
 */
export function createTreeFileAdapter(options: TreeFileAdapterOptions): FormatAdapter {
  const {
    format,
    extensions,
    sniff,
    parse,
    serialize,
    deriveEntry,
    extractPlaceholders,
    computeInvalidIcuKeys,
    validateMessage,
    validateTree,
    buildWriteTree,
    keyMode = "literal-leaf",
  } = options;
  return {
    format,
    canHandle: buildCanHandle(extensions, sniff),
    extractPlaceholders,
    validateMessage: validateMessage ?? ((): boolean => true),
    async read(filePath, locale): Promise<ReadResult> {
      const content = await readFileContent(filePath);
      const namespace = namespaceOf(filePath);
      const entries = toEntries(content, namespace, parse, deriveEntry, keyMode, validateTree);
      const resource: LocaleResource = { locale, namespace, format, entries };
      const invalidIcuKeys = computeIcu(entries, computeInvalidIcuKeys);
      return { resource, invalidIcuKeys };
    },
    async write(resource, filePath): Promise<void> {
      const tree = buildWriteTree
        ? await buildWriteTree(resource.entries, filePath)
        : unflattenEntries(resource.entries);
      await atomicWriteFile(filePath, serialize(tree));
    },
  };
}
