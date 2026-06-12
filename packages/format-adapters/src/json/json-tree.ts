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
  assertWithinDepth(parsed, MAX_DEPTH);
  const result = rootSchema.safeParse(parsed);
  if (!result.success) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "The file is not a valid JSON object (expected nested objects of string values).",
    );
  }
  return result.data;
}
