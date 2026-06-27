import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { readBounded } from "../json/bounded-read.js";
import type { JsonRecord } from "../json/json-tree.js";
import { unflattenEntries } from "../json/unflatten.js";

/** ngx-translate's two file styles: flat dotted keys, or nested objects. */
type Style = "flat" | "nested";

/**
 * Reject a file that mixes the two styles at the top level (a nested object sibling
 * to a flat dotted string key), since such a file is ambiguous rather than guessable.
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
