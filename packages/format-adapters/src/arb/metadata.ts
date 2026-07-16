import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { readFileContent } from "../json/bounded-read.js";
import { decodeKeyToSegments, encodeSegment } from "../json/key-encoding.js";
import { type OrderedRecord, type OrderedValue, parseOrderedJson } from "../json/ordered-json.js";

/** Both per-message (`@id`) and global (`@@locale`) ARB metadata keys start with `@`. */
function isMetadataKey(key: string): boolean {
  return key.startsWith("@");
}

/**
 * Parse raw ARB content into its ordered top-level Map, before any message-tree validation, so
 * metadata can be stripped first. Document key order is preserved everywhere, including metadata
 * subtrees such as integer-named `placeholders` blocks. Malformed syntax is `INVALID_JSON`; a
 * non-object root is `INVALID_STRUCTURE`.
 *
 * @param content - The untrusted ARB file content.
 * @returns The parsed ordered top-level Map with raw (unvalidated) values.
 * @throws {@link AdapterError} `INVALID_JSON`, `INVALID_STRUCTURE`, or `MAX_DEPTH_EXCEEDED`.
 */
export function parseArbObject(content: string): OrderedRecord {
  const parsed = parseOrderedJson(content);
  if (!(parsed instanceof Map)) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "The file is not a valid object (expected nested objects of string values).",
    );
  }
  return parsed;
}

/**
 * Drop every top-level `@`-prefixed metadata key from a parsed ARB object, leaving the translatable
 * messages.
 *
 * @param tree - The raw parsed ARB object.
 * @returns An ordered Map of the message keys only, still carrying raw values.
 */
export function stripArbMetadata(tree: OrderedRecord): OrderedRecord {
  const out = new Map<string, OrderedValue>();
  for (const [key, value] of tree) {
    if (!isMetadataKey(key)) {
      out.set(key, value);
    }
  }
  return out;
}

function originalKey(encoded: string): string {
  return decodeKeyToSegments(encoded).join(".");
}

/** The per-message key a metadata key describes, or null for a global `@@`-prefixed key. */
function messageKeyForMetadata(key: string): string | null {
  return isMetadataKey(key) && !key.startsWith("@@") ? key.slice(1) : null;
}

/** The `description` field of a metadata value, or undefined when absent or not a string. */
function descriptionOf(value: OrderedValue): string | undefined {
  if (!(value instanceof Map)) {
    return undefined;
  }
  const description = value.get("description");
  return typeof description === "string" ? description : undefined;
}

/**
 * Extract each `@<key>.description` from raw ARB content into a map keyed the same way
 * {@link flattenTree}'s literal-leaf encoding keys a top-level ARB message, so the result lines up
 * with the flattened entries by key. The content is parsed independently of the message tree, since
 * the description lives in metadata {@link stripArbMetadata} discards before flatten ever runs.
 *
 * @param content - The untrusted ARB file content.
 * @returns A map from flattened entry key to description; a key with no `@key.description` metadata
 *   is absent, never mapped to an empty or undefined description.
 */
export function extractArbDescriptions(content: string): ReadonlyMap<string, string> {
  const tree = parseArbObject(content);
  const out = new Map<string, string>();
  for (const [key, value] of tree) {
    const messageKey = messageKeyForMetadata(key);
    if (messageKey === null) {
      continue;
    }
    const description = descriptionOf(value);
    if (description !== undefined) {
      out.set(encodeSegment(messageKey), description);
    }
  }
  return out;
}

function messagesFromEntries(entries: ReadonlyMap<string, TranslationEntry>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, entry] of entries) {
    out.set(originalKey(key), entry.value);
  }
  return out;
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * Read the destination file's top-level pairs to merge metadata into a rewrite. A missing destination
 * (first write, `ENOENT`) is legitimate and yields `null` so the caller proceeds messages-only. A
 * destination that exists but cannot be used (bad JSON, wrong shape, unreadable, too large) is a real
 * problem: it is surfaced as a structured {@link AdapterError} instead of being silently discarded,
 * since discarding it would erase every `@`-prefixed metadata block with no error.
 *
 * @param filePath - The destination ARB file path.
 * @returns The destination's top-level entries in document order, or `null` when the destination
 *   does not exist.
 * @throws {@link AdapterError} `INVALID_JSON`, `INVALID_STRUCTURE`, or `INPUT_TOO_LARGE` when the
 *   destination exists but is not a usable ARB object.
 */
async function readDestinationPairs(
  filePath: string,
): Promise<Array<[string, OrderedValue]> | null> {
  let content: string;
  try {
    content = await readFileContent(filePath);
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
  return [...parseArbObject(content)];
}

/**
 * Build the ordered tree to write for ARB, preserving the destination's `@`-prefixed metadata and
 * document order: overwrite each message key with its translation, keep untranslated string values,
 * and append new keys in entry order. A missing destination (first write) yields the messages only,
 * in entry order. A destination that exists but is not a usable ARB object throws instead of silently
 * discarding its metadata; see {@link readDestinationPairs}.
 *
 * A destination pair that is neither `@`-prefixed metadata nor a translated or untranslated string
 * message (a stray non-string leaf accepted by the widened read schema but excluded from the entry
 * map) is dropped, not carried over: it was never a message this adapter owns the meaning of, so it
 * follows the same accept-and-exclude, do-not-preserve-on-write policy every tree-file adapter applies.
 *
 * @param entries - The translated entries to persist.
 * @param filePath - The destination ARB file path.
 * @returns The merged ordered Map ready to serialize.
 * @throws {@link AdapterError} `INVALID_JSON`, `INVALID_STRUCTURE`, or `INPUT_TOO_LARGE` when the
 *   destination exists but is corrupt, malformed, or too large.
 */
export async function buildArbWriteTree(
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
): Promise<OrderedRecord> {
  const messages = messagesFromEntries(entries);
  const pairs = await readDestinationPairs(filePath);
  const out = new Map<string, OrderedValue>();
  const consumed = new Set<string>();
  for (const [key, value] of pairs ?? []) {
    const translated = isMetadataKey(key) ? undefined : messages.get(key);
    if (translated !== undefined) {
      consumed.add(key);
      out.set(key, translated);
    } else if (isMetadataKey(key) || typeof value === "string") {
      out.set(key, value);
    }
  }
  for (const [key, value] of messages) {
    if (!consumed.has(key)) {
      out.set(key, value);
    }
  }
  return out;
}
