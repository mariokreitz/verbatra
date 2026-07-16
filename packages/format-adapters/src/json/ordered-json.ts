import { AdapterError } from "../errors.js";
import { MAX_DEPTH } from "./limits.js";

/**
 * A parsed JSON value in the ordered representation: scalars pass through, objects become
 * insertion-ordered Maps, and arrays stay arrays. Arrays exist at this layer only because ARB
 * metadata values are arbitrary JSON that must round-trip; the message-tree layer still rejects them.
 */
export type OrderedValue =
  | string
  | number
  | boolean
  | null
  | OrderedRecord
  | readonly OrderedValue[];

/** An ordered object node: a Map whose iteration order is the source document's key order. */
export type OrderedRecord = ReadonlyMap<string, OrderedValue>;

/** The six-character escape sequence prefixed onto every key token so no key stays integer-like. */
const SENTINEL_ESCAPE = "\\u0001";

/** JSON insignificant whitespace, the only characters allowed between a key token and its colon. */
function isJsonWhitespace(char: string | undefined): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

/**
 * The index just past a string token's closing quote, honoring backslash escapes. An unterminated
 * token runs to the end of the content; `JSON.parse` rejects the document afterwards.
 */
function endOfStringToken(content: string, openQuote: number): number {
  let index = openQuote + 1;
  while (index < content.length) {
    const char = content[index];
    if (char === "\\") {
      index += 2;
    } else if (char === '"') {
      return index + 1;
    } else {
      index += 1;
    }
  }
  return index;
}

/**
 * Whether the string token ending at `end` is an object key: the next non-whitespace character is a
 * colon. In valid JSON no value string can be followed by a colon, so the lookahead is unambiguous.
 */
function isKeyToken(content: string, end: number): boolean {
  let index = end;
  while (isJsonWhitespace(content[index])) {
    index += 1;
  }
  return content[index] === ":";
}

/**
 * Prefix one key token's content with the sentinel escape, rejecting a token that already contains
 * the sentinel escape text. The check runs on the raw token, so a key whose literal text contains
 * backslash-u-0001 is also rejected: a deliberate false positive that keeps the invariant watertight.
 * A raw U+0001 needs no check here because `JSON.parse` rejects unescaped control characters.
 */
function prefixKeyToken(token: string): string {
  if (token.includes(SENTINEL_ESCAPE)) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "A key contains a reserved control-character escape.",
    );
  }
  return `"${SENTINEL_ESCAPE}${token.slice(1)}`;
}

/**
 * Prefix every key token in a JSON document with the sentinel escape so no key is integer-like and
 * plain-object property order equals document order after `JSON.parse`. Value strings pass through
 * untouched, even when they contain the sentinel escape text.
 */
function prefixKeyTokens(content: string): string {
  let out = "";
  let index = 0;
  while (index < content.length) {
    const openQuote = content.indexOf('"', index);
    if (openQuote === -1) {
      return out + content.slice(index);
    }
    const end = endOfStringToken(content, openQuote);
    const token = content.slice(openQuote, end);
    out += content.slice(index, openQuote);
    out += isKeyToken(content, end) ? prefixKeyToken(token) : token;
    index = end;
  }
  return out;
}

/** The children of a container node, or null for a scalar leaf. */
function childrenOf(node: unknown): Iterable<unknown> | null {
  if (node instanceof Map) {
    return node.values();
  }
  if (Array.isArray(node)) {
    return node;
  }
  if (typeof node === "object" && node !== null) {
    return Object.values(node);
  }
  return null;
}

/**
 * Throws when container nesting exceeds `max`, walking Maps, arrays, and plain objects. Iterative
 * (explicit stack) so measuring depth never itself overflows before the cap is checked; it must run
 * before any recursive full-depth walk over untrusted input.
 *
 * @throws {@link AdapterError} `MAX_DEPTH_EXCEEDED`.
 */
export function assertWithinDepth(value: unknown, max: number): void {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === undefined) {
      break;
    }
    const children = childrenOf(top.node);
    if (children === null) {
      continue;
    }
    if (top.depth > max) {
      throw new AdapterError("MAX_DEPTH_EXCEEDED", "The file nests objects too deeply.");
    }
    for (const child of children) {
      stack.push({ node: child, depth: top.depth + 1 });
    }
  }
}

/**
 * Convert the sentinel-prefixed plain tree into the ordered tree, stripping exactly one leading
 * sentinel character from every object key. Recursion is safe here because the iterative depth cap
 * has already run. Duplicate-key semantics carry through bit-for-bit: `JSON.parse` keeps the first
 * occurrence's position with the last value, and `Map.set` on an existing key does the same.
 */
function toOrdered(node: unknown): OrderedValue {
  if (Array.isArray(node)) {
    return node.map((child) => toOrdered(child));
  }
  if (typeof node === "object" && node !== null) {
    const out = new Map<string, OrderedValue>();
    for (const [key, child] of Object.entries(node)) {
      out.set(key.slice(1), toOrdered(child));
    }
    return out;
  }
  return node as string | number | boolean | null;
}

/**
 * Parse untrusted JSON into an order-preserving representation: every object becomes a Map iterating
 * in document key order, at every nesting level. Built as a sentinel key-prefix transform over the
 * native `JSON.parse` so escape handling, the number grammar, and stack-safe parsing of hostile
 * deeply nested input are all inherited rather than reimplemented.
 *
 * @param content - The raw JSON file content.
 * @returns The ordered value; an object document yields an {@link OrderedRecord}.
 * @throws {@link AdapterError} `INVALID_JSON` on malformed syntax, `INVALID_STRUCTURE` on a key
 *   containing the reserved sentinel escape, or `MAX_DEPTH_EXCEEDED` past the nesting cap.
 */
export function parseOrderedJson(content: string): OrderedValue {
  const prefixed = prefixKeyTokens(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(prefixed);
  } catch {
    throw new AdapterError("INVALID_JSON", "The file is not valid JSON.");
  }
  assertWithinDepth(parsed, MAX_DEPTH);
  return toOrdered(parsed);
}

/** One record line per entry, emitted strictly in Map iteration order. */
function printRecord(record: OrderedRecord, indent: string): string {
  if (record.size === 0) {
    return "{}";
  }
  const childIndent = `${indent}  `;
  const lines: string[] = [];
  for (const [key, child] of record) {
    lines.push(`${childIndent}${JSON.stringify(key)}: ${printValue(child, childIndent)}`);
  }
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

/** One array line per item, matching `JSON.stringify`'s two-space array layout. */
function printArray(items: readonly OrderedValue[], indent: string): string {
  if (items.length === 0) {
    return "[]";
  }
  const childIndent = `${indent}  `;
  const lines = items.map((item) => `${childIndent}${printValue(item, childIndent)}`);
  return `[\n${lines.join(",\n")}\n${indent}]`;
}

function printValue(value: OrderedValue, indent: string): string {
  if (value instanceof Map) {
    return printRecord(value, indent);
  }
  if (Array.isArray(value)) {
    return printArray(value, indent);
  }
  return JSON.stringify(value);
}

/**
 * Serialize an ordered value to pretty-printed JSON text, byte-identical to
 * `JSON.stringify(equivalent, null, 2)` plus a trailing newline, except that Maps are emitted in
 * their iteration order instead of plain-object property order.
 *
 * @param value - The ordered value to serialize.
 * @returns The serialized text with a trailing newline.
 */
export function serializeOrderedJson(value: OrderedValue): string {
  return `${printValue(value, "")}\n`;
}
