import type { SupportedFormat, TranslationEntry } from "@verbatra/core";
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
  /**
   * Optional per-value message validator. Formats without ICU omit it and every value is valid;
   * ICU formats supply the same total check `computeInvalidIcuKeys` runs, applied to one value.
   */
  readonly validateMessage?: ValidateMessage;
  /** Optional; runs on the parsed tree before flattening (defaults to no check). */
  readonly validateTree?: ValidateTree;
  /** Optional; builds the object to write (defaults to nested via unflattenEntries). */
  readonly buildWriteTree?: BuildWriteTree;
  /**
   * Optional; how a dotted string key is interpreted. Defaults to `literal-leaf` (a
   * dotted string key is a single literal leaf and round-trips with its shape preserved).
   * ngx-translate sets `path-notation` because a dotted key there denotes a nested path.
   */
  readonly keyMode?: KeyMode;
}

/**
 * Build a JSON {@link FormatAdapter} from format-specific behavior. This is the shared shell every
 * JSON adapter (i18next, vue-i18n, next-intl, ngx-translate) is built on. It is a thin specialization
 * of {@link createTreeFileAdapter}: it fixes the `.json` extension, the leading-`{` content sniff,
 * `parseJsonObject`, and the pretty-printed-with-trailing-newline JSON serializer, and passes the
 * format-specific parts straight through. So detection, the bounded TOCTOU-safe read, structured
 * errors, and the atomic order-preserving write are all the shared tree shell.
 *
 * The returned adapter's methods throw as follows. `read` raises {@link AdapterError} with
 * `INVALID_JSON` (content is not valid JSON), `MAX_DEPTH_EXCEEDED` (nesting exceeds the depth cap),
 * `INVALID_STRUCTURE` (the path is not a regular file, the root is not a JSON object, a leaf is not a
 * string, or a supplied hook throws a non-AdapterError), or `INPUT_TOO_LARGE` (the file exceeds the
 * size cap), plus any `AdapterError` a supplied `validateTree` raises (for example, ngx-translate's
 * `MIXED_STRUCTURE`). In the default `literal-leaf` key mode, `read` also raises `INVALID_STRUCTURE`
 * when a literal dotted leaf key and a real nested path resolve to the same effective path within one
 * file. A missing or unopenable path instead rejects with the underlying filesystem error. `write`
 * raises `AdapterError` `INVALID_STRUCTURE` when a leaf key collides with a nested key path, and
 * rejects with the underlying filesystem error on a write failure.
 *
 * @param options - The format-specific behavior: the `format` tag, `deriveEntry` (placeholders and
 *   plurality per leaf), `extractPlaceholders`, and the optional `computeInvalidIcuKeys`,
 *   `validateMessage`, `validateTree`, `buildWriteTree`, and `keyMode` hooks.
 * @returns A ready-to-register `FormatAdapter` for the given format.
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
