import { readFile, stat } from "node:fs/promises";
import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import type { JsonRecord } from "../json/json-tree.js";
import { MAX_INPUT_BYTES } from "../json/limits.js";
import { unflattenEntries } from "../json/unflatten.js";

/** ngx-translate's two file styles: flat dotted keys, or nested objects. */
type Style = "flat" | "nested";

/**
 * Reject a file that mixes the two styles at the top level (a nested object sibling
 * to a flat dotted string key). ngx-translate documents that the styles should not be
 * mixed; an ambiguous file is rejected rather than guessed.
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

/**
 * Detect the structure style of the file currently at filePath, so a write can
 * preserve it. A top-level object value means nested; otherwise flat. A missing,
 * unreadable, or over-size destination (larger than MAX_INPUT_BYTES) is not read and
 * defaults to nested (the documented preference), so the write path is bounded by the
 * same limit as the read path.
 */
async function detectStyle(filePath: string): Promise<Style> {
  let parsed: unknown;
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size > MAX_INPUT_BYTES) {
      return "nested";
    }
    parsed = JSON.parse(await readFile(filePath, "utf8"));
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
