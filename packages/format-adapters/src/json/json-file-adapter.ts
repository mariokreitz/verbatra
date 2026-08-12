import type { FormatAdapter } from "../adapter.js";
import { parseJsonObject, serializeJsonTree, sniffJsonObject } from "./json-tree.js";
import { createTreeFileAdapter, type TreeFileAdapterOptions } from "./tree-file-adapter.js";

/** The format-specific behavior {@link createJsonFileAdapter} builds an adapter from. */
export type JsonFileAdapterOptions = Omit<
  TreeFileAdapterOptions,
  "extensions" | "sniff" | "parse" | "serialize"
>;

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
    sniff: sniffJsonObject,
    parse: parseJsonObject,
    serialize: serializeJsonTree,
  });
}
