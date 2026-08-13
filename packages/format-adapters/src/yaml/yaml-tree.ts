import { parse as parseYaml } from "yaml";
import { AdapterError } from "../errors.js";
import { assertJsonRecord, type JsonRecord } from "../json/json-tree.js";
import { MAX_DEPTH } from "../json/limits.js";
import { assertWithinDepth } from "../json/ordered-json.js";

function normalizeKey(key: unknown): string {
  if (typeof key === "object" && key !== null) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "A mapping key is a map or sequence (expected scalar keys).",
    );
  }
  return String(key);
}

function normalizeYamlTree(value: unknown): unknown {
  if (!(value instanceof Map)) {
    return value;
  }
  const out = new Map<string, unknown>();
  for (const [key, child] of value) {
    out.set(normalizeKey(key), normalizeYamlTree(child));
  }
  return out;
}

export function parseYamlObject(content: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = parseYaml(content, { mapAsMap: true, maxAliasCount: 100 });
  } catch {
    throw new AdapterError("INVALID_YAML", "The file is not valid YAML.");
  }
  assertWithinDepth(parsed, MAX_DEPTH);
  return assertJsonRecord(normalizeYamlTree(parsed));
}
