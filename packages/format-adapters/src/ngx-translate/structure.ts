import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { readBounded } from "../json/bounded-read.js";
import { isJsonNode, type JsonRecord } from "../json/json-tree.js";
import { decodePathKey } from "../json/key-encoding.js";
import type { OrderedRecord } from "../json/ordered-json.js";
import { unflattenEntries } from "../json/unflatten.js";

type Style = "flat" | "nested";

function assertNoDottedNestedKey(tree: JsonRecord): void {
  for (const [key, value] of tree) {
    if (!isJsonNode(value)) {
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

export function assertNotMixed(tree: JsonRecord): void {
  let hasNested = false;
  let hasFlatDottedKey = false;
  for (const [key, value] of tree) {
    if (isJsonNode(value)) {
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

function buildFlatTree(entries: ReadonlyMap<string, TranslationEntry>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, entry] of entries) {
    out.set(decodePathKey(key), entry.value);
  }
  return out;
}

export async function buildNgxWriteTree(
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
): Promise<OrderedRecord> {
  const style = await detectStyle(filePath);
  return style === "flat" ? buildFlatTree(entries) : unflattenEntries(entries);
}
