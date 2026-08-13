import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { readFileContent } from "../json/bounded-read.js";
import { decodeKeyToSegments, encodeSegment } from "../json/key-encoding.js";
import { type OrderedRecord, type OrderedValue, parseOrderedJson } from "../json/ordered-json.js";
import { isEnoent } from "../shell.js";

function isMetadataKey(key: string): boolean {
  return key.startsWith("@");
}

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

function messageKeyForMetadata(key: string): string | null {
  return isMetadataKey(key) && !key.startsWith("@@") ? key.slice(1) : null;
}

function descriptionOf(value: OrderedValue): string | undefined {
  if (!(value instanceof Map)) {
    return undefined;
  }
  const description = value.get("description");
  return typeof description === "string" ? description : undefined;
}

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
