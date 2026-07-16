import { z } from "zod";
import { AdapterError } from "../errors.js";
import { MAX_DEPTH } from "./limits.js";

/** A leaf value in a JSON translation file. Only a `string` leaf is translatable; the others are structural, non-message data that is accepted but excluded from the translatable entry set (see `flattenTree`). */
export type JsonLeaf = string | number | boolean | null;

/** A value in a JSON translation file: a leaf or a nested object. */
export type JsonTree = JsonLeaf | JsonRecord;

/** A nested object node in a JSON translation file, mapping keys to leaves or further nodes. */
export interface JsonRecord {
  readonly [key: string]: JsonTree;
}

const jsonTreeSchema: z.ZodType<JsonTree> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), jsonTreeSchema)]),
);

const rootSchema: z.ZodType<JsonRecord> = z.record(z.string(), jsonTreeSchema);

/** Throws when object nesting exceeds `max`. Iterative (explicit stack) so measuring depth never itself overflows before the cap is checked. */
function assertWithinDepth(value: unknown, max: number): void {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === undefined) {
      break;
    }
    const { node, depth } = top;
    if (typeof node !== "object" || node === null) {
      continue;
    }
    if (depth > max) {
      throw new AdapterError("MAX_DEPTH_EXCEEDED", "The file nests objects too deeply.");
    }
    for (const child of Object.values(node as Record<string, unknown>)) {
      stack.push({ node: child, depth: depth + 1 });
    }
  }
}

/**
 * Validate an already-parsed value as a tree of nested leaf values: enforce the depth cap and the
 * "object root, scalar leaves" shape. A leaf may be a string, number, boolean, or null; a non-string
 * leaf is structural, not a message, and `flattenTree` excludes it from the translatable entry set.
 * Parser-agnostic so JSON, YAML, and ARB share it. Error messages never echo file content or key paths.
 *
 * @param value - The already-parsed value to validate.
 * @returns The validated {@link JsonRecord}.
 * @throws {@link AdapterError} `MAX_DEPTH_EXCEEDED` or `INVALID_STRUCTURE`.
 */
export function assertJsonRecord(value: unknown): JsonRecord {
  assertWithinDepth(value, MAX_DEPTH);
  const result = rootSchema.safeParse(value);
  if (!result.success) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "The file is not a valid object (expected nested objects of string, number, boolean, or null leaves).",
    );
  }
  return result.data;
}

/**
 * Parse untrusted file content into a validated JSON object of nested leaves, throwing a structured
 * AdapterError (never a raw parser error) whose message never echoes file content or key paths.
 *
 * @throws {@link AdapterError} `INVALID_JSON`, `MAX_DEPTH_EXCEEDED`, or `INVALID_STRUCTURE`.
 */
export function parseJsonObject(content: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AdapterError("INVALID_JSON", "The file is not valid JSON.");
  }
  return assertJsonRecord(parsed);
}

/** Serialize a tree to pretty-printed JSON text with a trailing newline. */
export function serializeJsonTree(tree: unknown): string {
  return `${JSON.stringify(tree, null, 2)}\n`;
}

/** A parsed JSON/YAML value is a nested object node, never `null`: `typeof null` is `"object"`, so a `null` leaf must be checked out explicitly to avoid being treated as a nested node. */
export function isJsonNode(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}
