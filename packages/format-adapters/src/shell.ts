import { basename, extname } from "node:path";
import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { AdapterError } from "./errors.js";
import type { JsonRecord } from "./json/json-tree.js";

export type ExtractPlaceholders = (value: string) => readonly string[];

export type ComputeInvalidIcuKeys = (
  entries: ReadonlyMap<string, TranslationEntry>,
) => readonly string[];

export type ValidateMessage = (value: string) => boolean;

export type ComparePlaceholders = (
  sourceValue: string,
  targetValue: string,
) => PlaceholderIntegrityResult;

export type ValidateTree = (tree: JsonRecord) => void;

export type Sniff = (sample: string) => boolean;

export function scanTokens(
  value: string,
  pattern: RegExp,
  extract: (match: RegExpMatchArray) => string | undefined = (match) => match[0],
): readonly string[] {
  const result: string[] = [];
  for (const match of value.matchAll(pattern)) {
    const token = extract(match);
    if (token !== undefined) {
      result.push(token);
    }
  }
  return result;
}

export function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
}

export function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function rethrowStructured(error: unknown, message: string): never {
  if (error instanceof AdapterError) {
    throw error;
  }
  throw new AdapterError("INVALID_STRUCTURE", message);
}

export function computeIcu(
  entries: ReadonlyMap<string, TranslationEntry>,
  compute?: ComputeInvalidIcuKeys,
): readonly string[] {
  if (!compute) {
    return [];
  }
  try {
    return compute(entries);
  } catch (error) {
    rethrowStructured(error, "The file could not be analyzed for message validity.");
  }
}

export function buildCanHandle(
  extensions: readonly string[],
  sniff?: Sniff,
): (filePath: string, sample?: string) => boolean {
  return (filePath, sample): boolean => {
    if (!extensions.includes(extname(filePath).toLowerCase())) {
      return false;
    }
    return sample === undefined || sniff === undefined || sniff(sample);
  };
}
