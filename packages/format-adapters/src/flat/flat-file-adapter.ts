import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import { atomicWriteFile } from "../json/atomic-write.js";
import { readFileContent } from "../json/bounded-read.js";
import {
  buildCanHandle,
  computeIcu,
  namespaceOf,
  rethrowStructured,
  type Sniff,
} from "../shell.js";

/** Per-value placeholder extraction, exposed on the adapter for consumers. */
type ExtractPlaceholders = (value: string) => readonly string[];

/** Derives the keys whose values are invalid for the format's message syntax. */
type ComputeInvalidIcuKeys = (entries: ReadonlyMap<string, TranslationEntry>) => readonly string[];

/** Validates a single value against the format's message syntax (one value, before write). */
type ValidateMessage = (value: string) => boolean;

export interface FlatFileAdapterOptions {
  readonly format: SupportedFormat;
  /** Accepted file extensions, lower-cased and dot-prefixed (for example `[".xlf", ".xliff"]`). */
  readonly extensions: readonly string[];
  /** Optional content sniff; with none, the extension match alone decides `canHandle`. */
  readonly sniff?: Sniff;
  /** Parse file content into flat entries keyed by their native id; throws a structured AdapterError. */
  readonly parseEntries: (content: string, namespace: string) => Map<string, TranslationEntry>;
  /**
   * Serialize entries to file content. Flat formats that carry non-translatable structure (XLIFF
   * attributes and notes) re-read the destination here and mutate it in place, so they receive the
   * destination path and own their own missing-destination policy.
   */
  readonly serializeEntries: (
    entries: ReadonlyMap<string, TranslationEntry>,
    filePath: string,
  ) => Promise<string> | string;
  readonly extractPlaceholders: ExtractPlaceholders;
  readonly validateMessage?: ValidateMessage;
  readonly computeInvalidIcuKeys?: ComputeInvalidIcuKeys;
}

function toEntries(
  content: string,
  namespace: string,
  parseEntries: (content: string, namespace: string) => Map<string, TranslationEntry>,
): Map<string, TranslationEntry> {
  try {
    return parseEntries(content, namespace);
  } catch (error) {
    rethrowStructured(error, "The file could not be parsed.");
  }
}

/**
 * Build a flat-file {@link FormatAdapter} for a format whose entries are a flat list keyed by a native
 * id rather than a nested tree (XLIFF trans-units), supplying only `parseEntries` and
 * `serializeEntries` over the shared detection, bounded read, structured-error, and atomic-write shell.
 *
 * `read` raises {@link AdapterError} with the code `parseEntries` throws, `INVALID_STRUCTURE` (the
 * path is not a regular file, or `parseEntries` throws a non-AdapterError), or `INPUT_TOO_LARGE`.
 * `write` delegates to `serializeEntries` and persists its output atomically.
 *
 * @param options - The format-specific behavior.
 * @returns A ready-to-register `FormatAdapter`.
 */
export function createFlatFileAdapter(options: FlatFileAdapterOptions): FormatAdapter {
  const {
    format,
    extensions,
    sniff,
    parseEntries,
    serializeEntries,
    extractPlaceholders,
    validateMessage,
    computeInvalidIcuKeys,
  } = options;
  return {
    format,
    canHandle: buildCanHandle(extensions, sniff),
    extractPlaceholders,
    validateMessage: validateMessage ?? ((): boolean => true),
    async read(filePath, locale): Promise<ReadResult> {
      const content = await readFileContent(filePath);
      const namespace = namespaceOf(filePath);
      const entries = toEntries(content, namespace, parseEntries);
      const resource: LocaleResource = { locale, namespace, format, entries };
      const invalidIcuKeys = computeIcu(entries, computeInvalidIcuKeys);
      return { resource, invalidIcuKeys, excludedLeafPaths: [] };
    },
    async write(resource, filePath): Promise<void> {
      const data = await serializeEntries(resource.entries, filePath);
      await atomicWriteFile(filePath, data);
    },
  };
}
