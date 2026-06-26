import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { readBounded } from "../json/bounded-read.js";
import { decodeKeyToSegments } from "../json/key-encoding.js";

/**
 * Flutter ARB metadata keys are `@`-prefixed: `@messageId` per-message metadata (an object) and
 * `@@`-prefixed global metadata (for example `@@locale`). Both start with `@`, so one prefix test
 * covers them. Metadata is preserved on write and never translated.
 */
function isMetadataKey(key: string): boolean {
  return key.startsWith("@");
}

/**
 * Parse raw ARB content into its top-level object, before any message-tree validation. Flutter ARB
 * metadata legitimately carries non-string leaves and deep nesting (for example
 * `"@count": { "placeholders": { "count": { "optionalParameters": { "decimalDigits": 2 } } } }`), so
 * the metadata must be dropped before string-leaf and depth validation runs, otherwise a valid ARB
 * file would be rejected for metadata it never translates. This stops at "is a JSON object root",
 * reporting malformed syntax as `INVALID_JSON` and a non-object root as `INVALID_STRUCTURE`; it never
 * echoes file content.
 *
 * @param content - The untrusted ARB file content.
 * @returns The parsed top-level object with raw (unvalidated) values.
 * @throws {@link AdapterError} `INVALID_JSON` or `INVALID_STRUCTURE`.
 */
export function parseArbObject(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AdapterError("INVALID_JSON", "The file is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "The file is not a valid object (expected nested objects of string values).",
    );
  }
  return parsed as Record<string, unknown>;
}

/**
 * Drop every top-level `@`-prefixed metadata key from a parsed ARB object, so metadata never becomes
 * a {@link TranslationEntry} (never sent for translation), is never walked into spurious string
 * leaves, and is never subjected to message-tree validation (it commonly holds numeric and nested
 * leaves). The remaining keys are the translatable messages.
 *
 * @param tree - The raw parsed ARB object.
 * @returns A null-prototype object of the message keys only, still carrying raw values.
 */
export function stripArbMetadata(tree: Record<string, unknown>): Record<string, unknown> {
  const out = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(tree)) {
    if (!isMetadataKey(key)) {
      out[key] = value;
    }
  }
  return out;
}

/** Recover the original ARB message id from a flattened (literal-leaf encoded) entry key. */
function originalKey(encoded: string): string {
  return decodeKeyToSegments(encoded).join(".");
}

/** Map the translated entries to their original ARB message ids, preserving entry order. */
function messagesFromEntries(entries: ReadonlyMap<string, TranslationEntry>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, entry] of entries) {
    out.set(originalKey(key), entry.value);
  }
  return out;
}

/**
 * Re-read the destination ARB as an ordered list of key/value pairs, or null when it is missing,
 * unreadable, over the size cap, or not a JSON object. Bounded by the same size cap as the read path.
 */
async function readDestinationPairs(filePath: string): Promise<Array<[string, unknown]> | null> {
  let parsed: unknown;
  try {
    const outcome = await readBounded(filePath);
    if (outcome.kind !== "ok") {
      return null;
    }
    parsed = JSON.parse(outcome.content);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  return Object.entries(parsed);
}

/**
 * Build the object to write for ARB, preserving the destination's `@`-prefixed metadata and document
 * order: walk the destination in order, keeping each metadata key verbatim, overwriting each message
 * key with its translation (or keeping the destination value when a key was not translated), then
 * appending any brand-new message keys in entry order. A missing or unreadable destination (a fresh
 * target locale file, which in Flutter omits metadata) yields the messages only, in entry order.
 *
 * @param entries - The translated entries to persist.
 * @param filePath - The destination ARB file path.
 * @returns The merged object ready to serialize.
 */
export async function buildArbWriteTree(
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
): Promise<unknown> {
  const messages = messagesFromEntries(entries);
  const pairs = await readDestinationPairs(filePath);
  const out = Object.create(null) as Record<string, unknown>;
  const consumed = new Set<string>();
  for (const [key, value] of pairs ?? []) {
    const translated = isMetadataKey(key) ? undefined : messages.get(key);
    if (translated !== undefined) {
      consumed.add(key);
    }
    out[key] = translated ?? value;
  }
  for (const [key, value] of messages) {
    if (!consumed.has(key)) {
      out[key] = value;
    }
  }
  return out;
}
