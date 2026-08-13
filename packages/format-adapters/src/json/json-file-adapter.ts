import type { FormatAdapter } from "../adapter.js";
import { parseJsonObject, serializeJsonTree, sniffJsonObject } from "./json-tree.js";
import { createTreeFileAdapter, type TreeFileAdapterOptions } from "./tree-file-adapter.js";

export type JsonFileAdapterOptions = Omit<
  TreeFileAdapterOptions,
  "extensions" | "sniff" | "parse" | "serialize"
>;

export function createJsonFileAdapter(options: JsonFileAdapterOptions): FormatAdapter {
  return createTreeFileAdapter({
    ...options,
    extensions: [".json"],
    sniff: sniffJsonObject,
    parse: parseJsonObject,
    serialize: serializeJsonTree,
  });
}
