import { AdapterError } from "../errors.js";
import { MAX_DEPTH } from "./limits.js";
import {
  assertWithinDepth,
  type OrderedRecord,
  parseOrderedJson,
  serializeOrderedJson,
} from "./ordered-json.js";

/** A leaf value in a JSON translation file. Only a `string` leaf is translatable; the others are structural, non-message data that is accepted but excluded from the translatable entry set (see `flattenTree`). */
export type JsonLeaf = string | number | boolean | null;

/** A value in a JSON translation file: a leaf or a nested node. */
export type JsonTree = JsonLeaf | JsonRecord;

/** A nested node in a JSON translation file: a Map from key to leaf or further node, iterating in document key order. */
export type JsonRecord = ReadonlyMap<string, JsonTree>;

const INVALID_STRUCTURE_MESSAGE =
  "The file is not a valid object (expected nested objects of string, number, boolean, or null leaves).";

function isJsonLeaf(value: unknown): value is JsonLeaf {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

/** Throws unless every key of every node is a string and every non-Map value is a scalar leaf. Iterative (explicit stack), like the depth walk, so validation itself never risks the call stack. */
function assertNodesValid(root: ReadonlyMap<unknown, unknown>): void {
  const stack: Array<ReadonlyMap<unknown, unknown>> = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      break;
    }
    for (const [key, child] of node) {
      if (typeof key !== "string") {
        throw new AdapterError("INVALID_STRUCTURE", INVALID_STRUCTURE_MESSAGE);
      }
      if (child instanceof Map) {
        stack.push(child);
      } else if (!isJsonLeaf(child)) {
        throw new AdapterError("INVALID_STRUCTURE", INVALID_STRUCTURE_MESSAGE);
      }
    }
  }
}

/**
 * Validate an already-parsed ordered value as a tree of nested leaf values: enforce the depth cap and
 * the "Map root, scalar leaves" shape. A leaf may be a string, number, boolean, or null; a non-string
 * leaf is structural, not a message, and `flattenTree` excludes it from the translatable entry set.
 * Parser-agnostic so JSON, YAML, and ARB share it. Error messages never echo file content or key paths.
 *
 * @param value - The already-parsed value to validate.
 * @returns The validated {@link JsonRecord}.
 * @throws {@link AdapterError} `MAX_DEPTH_EXCEEDED` or `INVALID_STRUCTURE`.
 */
export function assertJsonRecord(value: unknown): JsonRecord {
  assertWithinDepth(value, MAX_DEPTH);
  if (!(value instanceof Map)) {
    throw new AdapterError("INVALID_STRUCTURE", INVALID_STRUCTURE_MESSAGE);
  }
  assertNodesValid(value);
  return value as JsonRecord;
}

/**
 * Parse untrusted file content into a validated ordered tree of nested leaves, preserving the
 * document's key order at every nesting level, and throwing a structured AdapterError (never a raw
 * parser error) whose message never echoes file content or key paths.
 *
 * @throws {@link AdapterError} `INVALID_JSON`, `MAX_DEPTH_EXCEEDED`, or `INVALID_STRUCTURE`.
 */
export function parseJsonObject(content: string): JsonRecord {
  return assertJsonRecord(parseOrderedJson(content));
}

/** Serialize an ordered tree to pretty-printed JSON text with a trailing newline, following Map iteration order exactly. */
export function serializeJsonTree(tree: OrderedRecord): string {
  return serializeOrderedJson(tree);
}

/** A parsed value is a nested node exactly when it is a Map; every leaf, including `null`, is a non-Map. */
export function isJsonNode(value: unknown): value is JsonRecord {
  return value instanceof Map;
}
