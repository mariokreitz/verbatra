import type { PlaceholderIntegrityResult, SupportedFormat, TranslationEntry } from "@verbatra/core";
import type { FormatAdapter } from "../adapter.js";
import type { DeriveEntry, KeyMode } from "./flatten.js";
import { type JsonRecord, parseJsonObject, serializeJsonTree } from "./json-tree.js";
import { createTreeFileAdapter } from "./tree-file-adapter.js";

/** Per-value placeholder extraction, exposed on the adapter for consumers. */
type ExtractPlaceholders = (value: string) => readonly string[];

/** Derives the keys whose values are invalid for the format's message syntax. */
type ComputeInvalidIcuKeys = (entries: ReadonlyMap<string, TranslationEntry>) => readonly string[];

/** Validates a single value against the format's message syntax (one value, before write). */
type ValidateMessage = (value: string) => boolean;

/** Optional branch-aware placeholder comparison; see `FormatAdapter.comparePlaceholders`. */
type ComparePlaceholders = (sourceValue: string, targetValue: string) => PlaceholderIntegrityResult;

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
  /** Optional per-value message validator; formats without ICU omit it and every value is valid. */
  readonly validateMessage?: ValidateMessage;
  /** Optional; runs on the parsed tree before flattening (defaults to no check). */
  readonly validateTree?: ValidateTree;
  /** Optional; builds the object to write (defaults to nested via unflattenEntries). */
  readonly buildWriteTree?: BuildWriteTree;
  /** Optional; how a dotted string key is interpreted (defaults to `literal-leaf`). */
  readonly keyMode?: KeyMode;
  /** Optional branch-aware placeholder comparison; formats without plural/select branching omit it. */
  readonly comparePlaceholders?: ComparePlaceholders;
}

/**
 * Build a JSON {@link FormatAdapter} from format-specific behavior. The shared shell every JSON adapter
 * (i18next, vue-i18n, next-intl, ngx-translate) is built on: a thin specialization of
 * {@link createTreeFileAdapter} that fixes the `.json` extension, the leading-`{` sniff, `parseJsonObject`,
 * and the pretty-printed JSON serializer, and passes the format-specific parts through.
 *
 * @param options - The format-specific behavior (format tag, `deriveEntry`, `extractPlaceholders`, and
 *   the optional `computeInvalidIcuKeys`, `validateMessage`, `validateTree`, `buildWriteTree`, `keyMode`).
 * @returns A ready-to-register `FormatAdapter` for the given format.
 * @throws {@link AdapterError} from `read` (`INVALID_JSON`, `MAX_DEPTH_EXCEEDED`, `INVALID_STRUCTURE`,
 *   `INPUT_TOO_LARGE`) or from `write` (`INVALID_STRUCTURE` on a leaf-vs-nested key collision). A missing
 *   path rejects with the underlying filesystem error.
 * @example
 * ```ts
 * export function createMyJsonAdapter(): FormatAdapter {
 *   const extract = (value: string): readonly string[] =>
 *     [...value.matchAll(/\{\{\w+\}\}/g)].map((m) => m[0]).filter((t): t is string => t !== undefined);
 *   return createJsonFileAdapter({
 *     format: "i18next-json",
 *     extractPlaceholders: extract,
 *     deriveEntry: (key, value) => ({ placeholders: extract(value), isPlural: key.endsWith("_other") }),
 *   });
 * }
 * ```
 */
export function createJsonFileAdapter(options: JsonFileAdapterOptions): FormatAdapter {
  return createTreeFileAdapter({
    ...options,
    extensions: [".json"],
    sniff: (sample) => sample.trimStart().startsWith("{"),
    parse: parseJsonObject,
    serialize: serializeJsonTree,
  });
}
