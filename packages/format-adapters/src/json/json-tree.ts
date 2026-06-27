import { z } from "zod";
import { AdapterError } from "../errors.js";
import { MAX_DEPTH } from "./limits.js";

/** A value in a JSON translation file: a string or a nested object. */
export type JsonTree = string | JsonRecord;
export interface JsonRecord {
  readonly [key: string]: JsonTree;
}

const jsonTreeSchema: z.ZodType<JsonTree> = z.lazy(() =>
  z.union([z.string(), z.record(z.string(), jsonTreeSchema)]),
);

const rootSchema: z.ZodType<JsonRecord> = z.record(z.string(), jsonTreeSchema);

/**
 * Reject input nested deeper than max before any recursive work runs. Iterative
 * (explicit stack), so measuring depth never itself overflows, and it bounds the
 * depth the recursive schema and flattening will later see.
 */
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
 * Validate an already-parsed value as a tree of nested string values: enforce the depth cap and the
 * "object root, string leaves" shape. Parser-agnostic on purpose, so every tree format (JSON, YAML,
 * ARB) shares the exact same depth, structure, and null-prototype guarantees with only the syntactic
 * parser swapped ahead of it. Over-deep nesting is MAX_DEPTH_EXCEEDED; a non-object root or a
 * non-string leaf is INVALID_STRUCTURE. Never echoes file content or key paths.
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
      "The file is not a valid object (expected nested objects of string values).",
    );
  }
  return result.data;
}

/**
 * Parse untrusted file content into a validated JSON object of nested strings.
 * Throws a structured AdapterError (never a raw parser error) and never echoes file
 * content or key paths: malformed syntax is INVALID_JSON, over-deep nesting is
 * MAX_DEPTH_EXCEEDED, a non-object root or non-string leaf is INVALID_STRUCTURE.
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

/** Serialize a tree to pretty-printed JSON text with a trailing newline (the JSON and ARB policy). */
export function serializeJsonTree(tree: unknown): string {
  return `${JSON.stringify(tree, null, 2)}\n`;
}
