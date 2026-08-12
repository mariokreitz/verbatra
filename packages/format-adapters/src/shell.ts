import { basename, extname } from "node:path";
import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { AdapterError } from "./errors.js";
import type { JsonRecord } from "./json/json-tree.js";

/** Per-value placeholder extraction, exposed on the adapter for consumers. */
export type ExtractPlaceholders = (value: string) => readonly string[];

/** Derives the keys whose values are invalid for the format's message syntax. */
export type ComputeInvalidIcuKeys = (
  entries: ReadonlyMap<string, TranslationEntry>,
) => readonly string[];

/** Validates a single value against the format's message syntax (one value, before write). */
export type ValidateMessage = (value: string) => boolean;

/** Optional branch-aware placeholder comparison; see `FormatAdapter.comparePlaceholders`. */
export type ComparePlaceholders = (
  sourceValue: string,
  targetValue: string,
) => PlaceholderIntegrityResult;

/** Optional check on the parsed tree before flattening (for example, reject mixed structure). */
export type ValidateTree = (tree: JsonRecord) => void;

/** A content sniff: inspect a leading sample and decide whether this adapter could handle it. */
export type Sniff = (sample: string) => boolean;

/**
 * Scan `value` for every match of `pattern` and collect the token each match contributes, in
 * document order with every occurrence preserved (not deduplicated). `extract` defaults to the
 * whole match (`match[0]`); a format that instead normalizes a capture group (vue-i18n) supplies
 * its own. A match that yields no token (`extract` returns `undefined`) is skipped.
 */
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

/** The base name of a file with its extension stripped, used as the resource namespace. */
export function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
}

/** True when `error` is a Node filesystem error reporting a missing path (`ENOENT`). */
export function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Rethrow an existing structured {@link AdapterError} unchanged, or convert any other throw into one
 * so boundary failures never escape `read` as a raw error.
 */
export function rethrowStructured(error: unknown, message: string): never {
  if (error instanceof AdapterError) {
    throw error;
  }
  throw new AdapterError("INVALID_STRUCTURE", message);
}

/**
 * Compute the format's invalid-message keys, mapping any throw to a structured {@link AdapterError}.
 * Formats without ICU pass no compute and get an empty result.
 */
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

/**
 * Build a `canHandle` from an extension allow-list plus an optional content sniff. The extension
 * (lower-cased) must be in `extensions`; when both a sample and a `sniff` are present, the sniff must
 * also accept it.
 */
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
