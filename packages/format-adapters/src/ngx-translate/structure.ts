import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { readBounded } from "../json/bounded-read.js";
import type { JsonRecord } from "../json/json-tree.js";
import { unflattenEntries } from "../json/unflatten.js";

/** ngx-translate's two file styles: flat dotted keys, or nested objects. */
type Style = "flat" | "nested";

/**
 * Reject a nested object key that itself contains a literal dot, at any depth. Path-notation
 * flatten joins segments with a plain, unescaped dot, so such a key is indistinguishable from a
 * further nested path once flattened: on write, `decodeKeyToSegments` would split it back into
 * separate segments, silently restructuring one object key into nested objects and, when a
 * sibling key already occupies part of that path, merging the two. Rejecting it up front, before
 * flattening, avoids both outcomes.
 */
function assertNoDottedNestedKey(tree: JsonRecord): void {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value !== "object") {
      continue;
    }
    if (key.includes(".")) {
      throw new AdapterError(
        "MIXED_STRUCTURE",
        "A nested object key contains a literal dot, which is ambiguous with a dotted path.",
      );
    }
    assertNoDottedNestedKey(value);
  }
}

/**
 * Reject a file that mixes the two styles at the top level (a nested object sibling
 * to a flat dotted string key), since such a file is ambiguous rather than guessable.
 * Also rejects a nested object key that contains a literal dot at any depth (see
 * {@link assertNoDottedNestedKey}), since that is ambiguous with path notation regardless of
 * whether it has a flat-dotted-key sibling at the same level.
 */
export function assertNotMixed(tree: JsonRecord): void {
  let hasNested = false;
  let hasFlatDottedKey = false;
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "object") {
      hasNested = true;
    } else if (key.includes(".")) {
      hasFlatDottedKey = true;
    }
  }
  if (hasNested && hasFlatDottedKey) {
    throw new AdapterError(
      "MIXED_STRUCTURE",
      "The file mixes flat dotted keys with nested objects.",
    );
  }
  assertNoDottedNestedKey(tree);
}

// A missing, unreadable, or over-size destination is not read and defaults to nested, so the write
// path stays bounded by the same limit as the read path.
async function detectStyle(filePath: string): Promise<Style> {
  let parsed: unknown;
  try {
    const outcome = await readBounded(filePath);
    if (outcome.kind !== "ok") {
      return "nested";
    }
    parsed = JSON.parse(outcome.content);
  } catch {
    return "nested";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "nested";
  }
  for (const value of Object.values(parsed as Record<string, unknown>)) {
    if (typeof value === "object" && value !== null) {
      return "nested";
    }
  }
  return "flat";
}

/** Flat object of dotted keys, built on a null prototype so input keys cannot pollute. */
function buildFlatTree(entries: ReadonlyMap<string, TranslationEntry>): Record<string, string> {
  const out = Object.create(null) as Record<string, string>;
  for (const [key, entry] of entries) {
    out[key] = entry.value;
  }
  return out;
}

/**
 * Build the object to write, preserving the destination file's structure style:
 * flat stays flat, nested stays nested. A new destination is written nested.
 */
export async function buildNgxWriteTree(
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
): Promise<unknown> {
  const style = await detectStyle(filePath);
  return style === "flat" ? buildFlatTree(entries) : unflattenEntries(entries);
}
