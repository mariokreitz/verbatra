import type { LocaleResource, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter, ReadResult } from "../adapter.js";
import { type AdapterFs, nodeAdapterFs } from "../fs-port.js";
import { readFileContent } from "../json/bounded-read.js";
import {
  buildCanHandle,
  type ComputeInvalidIcuKeys,
  computeIcu,
  type ExtractPlaceholders,
  namespaceOf,
  rethrowStructured,
  type Sniff,
  type ValidateMessage,
} from "../shell.js";

export interface FlatFileAdapterOptions {
  readonly format: SupportedFormat;
  readonly extensions: readonly string[];
  readonly sniff?: Sniff;
  readonly parseEntries: (content: string, namespace: string) => Map<string, TranslationEntry>;
  readonly serializeEntries: (
    entries: ReadonlyMap<string, TranslationEntry>,
    filePath: string,
    fs: AdapterFs,
  ) => Promise<string> | string;
  readonly extractPlaceholders: ExtractPlaceholders;
  readonly validateMessage?: ValidateMessage;
  readonly computeInvalidIcuKeys?: ComputeInvalidIcuKeys;
  readonly fs?: AdapterFs;
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
    fs = nodeAdapterFs,
  } = options;
  return {
    format,
    canHandle: buildCanHandle(extensions, sniff),
    extractPlaceholders,
    validateMessage: validateMessage ?? ((): boolean => true),
    async read(filePath, locale): Promise<ReadResult> {
      const content = await readFileContent(fs, filePath);
      const namespace = namespaceOf(filePath);
      const entries = toEntries(content, namespace, parseEntries);
      const resource: LocaleResource = { locale, namespace, format, entries };
      const invalidIcuKeys = computeIcu(entries, computeInvalidIcuKeys);
      return { resource, invalidIcuKeys, excludedLeafPaths: [] };
    },
    async write(resource, filePath): Promise<void> {
      const data = await serializeEntries(resource.entries, filePath, fs);
      await fs.writeFileAtomic(filePath, data);
    },
  };
}
