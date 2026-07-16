import { parse as parseYaml } from "yaml";
import { AdapterError } from "../errors.js";
import { assertJsonRecord, type JsonRecord } from "../json/json-tree.js";
import { MAX_DEPTH } from "../json/limits.js";
import { assertWithinDepth } from "../json/ordered-json.js";

/**
 * Coerce a scalar YAML key to its string form, matching what the previous plain-object parse
 * produced for non-string scalar keys (`1:` stays `"1"`, `true:` stays `"true"`). A composite key
 * (a map or sequence used as a key) has no faithful string form and is rejected instead of silently
 * collapsing to its object stringification.
 */
function normalizeKey(key: unknown): string {
  if (typeof key === "object" && key !== null) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "A mapping key is a map or sequence (expected scalar keys).",
    );
  }
  return String(key);
}

/**
 * Rebuild the parsed value with every mapping key normalized to a string. Recursion is safe here
 * because the iterative depth cap has already run; a sequence passes through unchanged and is
 * rejected later by `assertJsonRecord`.
 */
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

/**
 * Parse untrusted YAML into a validated ordered tree of nested leaves, reusing the same structure
 * validation as JSON ({@link assertJsonRecord}). Mappings are parsed as Maps (`mapAsMap`) so the
 * document's key order is preserved at every nesting level, including integer-like keys. Anchor-alias
 * expansion is bounded (`maxAliasCount`) so a billion-laughs document cannot blow up, and the default
 * core schema resolves no JS-typed tags.
 *
 * @param content - The raw YAML file content.
 * @returns The validated {@link JsonRecord}.
 * @throws {@link AdapterError} `INVALID_YAML`, `INVALID_STRUCTURE` (also raised for a composite
 *   mapping key), or `MAX_DEPTH_EXCEEDED`.
 */
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
