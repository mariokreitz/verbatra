import { basename, extname } from "node:path";
import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "./errors.js";

/** Derives the keys whose values are invalid for the format's message syntax. */
type ComputeInvalidIcuKeys = (entries: ReadonlyMap<string, TranslationEntry>) => readonly string[];

/** A content sniff: inspect a leading sample and decide whether this adapter could handle it. */
export type Sniff = (sample: string) => boolean;

/** The base name of a file with its extension stripped, used as the resource namespace. */
export function namespaceOf(filePath: string): string {
  return basename(filePath, extname(filePath));
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
