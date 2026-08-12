import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { type BoundedReadOutcome, outcomeToContent, readBounded } from "../json/bounded-read.js";
import { isEnoent } from "../shell.js";
import { extractPropertiesPlaceholders } from "./placeholders.js";

/**
 * One ordered element of a parsed `.properties` file: a `raw` line (a comment or a blank, kept
 * verbatim so it survives a round trip) or an `entry` line (a decoded key and value). Comments and
 * blanks carry no translatable value, so only `entry` items become {@link TranslationEntry}s; the
 * serializer re-reads them to preserve the file's structure and key order.
 */
type ParsedItem =
  | { readonly kind: "raw"; readonly text: string }
  | { readonly kind: "entry"; readonly key: string; readonly value: string };

const UNICODE_ESCAPE = /^[0-9a-fA-F]{4}$/;
const LEADING_WHITESPACE = /^[ \t\f]+/;
const TRAILING_TERMINATOR = /(?:\r\n|\r|\n)$/;

/** One of the three line terminators a `.properties` file may use. */
type LineTerminator = "\n" | "\r\n" | "\r";

/**
 * Pick the terminator a destination should be written back with. Any CRLF in the file wins for the
 * whole file, then any lone CR; a file with neither (and a missing destination) is written with LF.
 *
 * A mixed file therefore converges on one style rather than being preserved line by line:
 * reproducing a mixture faithfully would mean tracking a terminator per line for no practical
 * benefit, and converging is what keeps the round trip a fixed point.
 */
function detectLineTerminator(content: string): LineTerminator {
  if (content.includes("\r\n")) {
    return "\r\n";
  }
  return content.includes("\r") ? "\r" : "\n";
}

function isPropertiesWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\f";
}

/**
 * Split raw content into physical lines on any of the three properties line terminators (`\n`,
 * `\r\n`, `\r`). A single trailing terminator marks end-of-file, not an extra blank line, so its
 * empty tail is dropped; an interior blank line is preserved.
 */
function splitPhysicalLines(content: string): string[] {
  if (content === "") {
    return [];
  }
  const lines = content.split(/\r\n|\r|\n/);
  if (TRAILING_TERMINATOR.test(content)) {
    lines.pop();
  }
  return lines;
}

function countTrailingBackslashes(line: string): number {
  let count = 0;
  for (let i = line.length - 1; i >= 0 && line[i] === "\\"; i -= 1) {
    count += 1;
  }
  return count;
}

function isContinued(line: string): boolean {
  return countTrailingBackslashes(line) % 2 === 1;
}

function isBlankLine(line: string): boolean {
  return line.trim() === "";
}

function isCommentLine(line: string): boolean {
  const trimmed = line.replace(LEADING_WHITESPACE, "");
  return trimmed.startsWith("#") || trimmed.startsWith("!");
}

/**
 * Join a logical line starting at `start`, following backslash continuations (a line continues when
 * it ends with an odd number of backslashes) and stripping the leading whitespace of each appended
 * physical line. A dangling continuation at end-of-file drops its trailing backslash.
 */
function joinContinuation(
  lines: readonly string[],
  start: number,
): { readonly logical: string; readonly nextIndex: number } {
  const pieces: string[] = [];
  let index = start;
  let current = lines[start] ?? "";
  while (isContinued(current) && index + 1 < lines.length) {
    pieces.push(current.slice(0, -1));
    index += 1;
    current = (lines[index] ?? "").replace(LEADING_WHITESPACE, "");
  }
  if (isContinued(current)) {
    current = current.slice(0, -1);
  }
  pieces.push(current);
  return { logical: pieces.join(""), nextIndex: index + 1 };
}

function decodeSimpleEscape(char: string): string {
  switch (char) {
    case "t":
      return "\t";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "f":
      return "\f";
    default:
      return char;
  }
}

function decodeUnicodeEscape(raw: string, at: number): string {
  const hex = raw.slice(at, at + 4);
  if (!UNICODE_ESCAPE.test(hex)) {
    throw new AdapterError("INVALID_STRUCTURE", "The file has a malformed unicode escape.");
  }
  return String.fromCharCode(Number.parseInt(hex, 16));
}

/**
 * Decode the properties escape sequences in a key or value: `\t \n \r \f`, `\uXXXX`, and the literal
 * escapes (`\\`, `\=`, `\:`, `\#`, `\!`, `\ `). Any other escaped character yields that character.
 * A malformed `\uXXXX` (non-hex or truncated) raises a structured {@link AdapterError}.
 */
function decodeEscapes(raw: string): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const char = raw[i];
    if (char !== "\\") {
      out += char;
      i += 1;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) {
      break;
    }
    if (next === "u") {
      out += decodeUnicodeEscape(raw, i + 2);
      i += 6;
      continue;
    }
    out += decodeSimpleEscape(next);
    i += 2;
  }
  return out;
}

function keyEndIndex(logical: string, from: number): number {
  let i = from;
  while (i < logical.length) {
    const char = logical[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === undefined || isPropertiesWhitespace(char) || char === "=" || char === ":") {
      break;
    }
    i += 1;
  }
  return i;
}

function skipWhitespace(logical: string, from: number): number {
  let i = from;
  while (i < logical.length) {
    const char = logical[i];
    if (char === undefined || !isPropertiesWhitespace(char)) {
      break;
    }
    i += 1;
  }
  return i;
}

/**
 * Split one logical line into a decoded key and value. The key runs to the first unescaped
 * separator (`=` or `:`) or whitespace; a single separator and any whitespace around it are then
 * consumed, and the rest is the value. A line with no separator is a key with an empty value.
 */
function parseEntryLine(logical: string): { readonly key: string; readonly value: string } {
  const keyStart = skipWhitespace(logical, 0);
  const keyEnd = keyEndIndex(logical, keyStart);
  const afterKey = skipWhitespace(logical, keyEnd);
  const separator = logical[afterKey];
  const valueStart =
    separator === "=" || separator === ":" ? skipWhitespace(logical, afterKey + 1) : afterKey;
  return {
    key: decodeEscapes(logical.slice(keyStart, keyEnd)),
    value: decodeEscapes(logical.slice(valueStart)),
  };
}

function parseItems(content: string): ParsedItem[] {
  const lines = splitPhysicalLines(content);
  const items: ParsedItem[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (isBlankLine(line) || isCommentLine(line)) {
      items.push({ kind: "raw", text: line });
      i += 1;
      continue;
    }
    const { logical, nextIndex } = joinContinuation(lines, i);
    items.push({ kind: "entry", ...parseEntryLine(logical) });
    i = nextIndex;
  }
  return items;
}

/**
 * Parse `.properties` content into flat entries keyed by the property key verbatim (never split into
 * a tree), with all escapes decoded on the value. Comments and blank lines carry no entry. A
 * duplicate key keeps its first position and takes the last value, matching `Properties.load`.
 * Malformed content (an invalid `\uXXXX`) surfaces as a structured {@link AdapterError}.
 */
export function parsePropertiesEntries(
  content: string,
  namespace: string,
): Map<string, TranslationEntry> {
  const map = new Map<string, TranslationEntry>();
  for (const item of parseItems(content)) {
    if (item.kind === "entry") {
      map.set(item.key, {
        key: item.key,
        namespace,
        value: item.value,
        placeholders: extractPropertiesPlaceholders(item.value),
        isPlural: false,
      });
    }
  }
  return map;
}

function unicodeEscape(code: number): string {
  return `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Escape one character for output. Keys escape every space and the separator and comment characters
 * (`=`, `:`, `#`, `!`); values escape only a leading space and never the separators, which are
 * literal mid-value. Both escape control characters and every non-ASCII code point (> 0x7E) to
 * `\uXXXX`, so the file loads under a legacy ISO-8859-1 `Properties.load`.
 */
function escapeChar(char: string, isFirst: boolean, isKey: boolean): string {
  switch (char) {
    case "\\":
      return "\\\\";
    case "\t":
      return "\\t";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\f":
      return "\\f";
    case " ":
      return isKey || isFirst ? "\\ " : " ";
    default:
      break;
  }
  if (isKey && (char === "=" || char === ":" || char === "#" || char === "!")) {
    return `\\${char}`;
  }
  const code = char.charCodeAt(0);
  return code < 0x20 || code > 0x7e ? unicodeEscape(code) : char;
}

function escapeString(input: string, isKey: boolean): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char !== undefined) {
      out += escapeChar(char, i === 0, isKey);
    }
  }
  return out;
}

function formatEntry(key: string, value: string): string {
  return `${escapeString(key, true)}=${escapeString(value, false)}`;
}

/** A destination's existing shape: what to rewrite, and the terminator to rewrite it with. */
interface DestinationStructure {
  readonly items: ParsedItem[];
  readonly terminator: LineTerminator;
}

/**
 * Read the destination's existing structure so a write preserves its comments, blank lines, key
 * order, and line terminator. A missing destination (`ENOENT`) yields an empty structure and LF (the
 * file is synthesized from entries alone); any other read failure, or a path that is not a regular
 * file, is `INVALID_STRUCTURE`, and an oversized one is `INPUT_TOO_LARGE`.
 */
async function readStructure(filePath: string): Promise<DestinationStructure> {
  let outcome: BoundedReadOutcome;
  try {
    outcome = await readBounded(filePath);
  } catch (error) {
    if (isEnoent(error)) {
      return { items: [], terminator: "\n" };
    }
    throw new AdapterError("INVALID_STRUCTURE", "The destination file could not be read.");
  }
  const content = outcomeToContent(outcome, "The destination path is not a regular file.");
  return {
    items: parseItems(content),
    terminator: detectLineTerminator(content),
  };
}

/**
 * Serialize entries into canonical `.properties` text, preserving the destination's comments, blank
 * lines, and key order by re-reading it: each existing key line is rewritten as `key=value` with the
 * entry's value (a key no longer present is dropped), and any entry the destination lacks is
 * appended in iteration order. Keys use the `=` separator, every non-ASCII code point is escaped to
 * `\uXXXX`, and the significant characters are escaped per the properties spec.
 *
 * The destination's line terminator is preserved too: a file containing any CRLF is written back
 * entirely with CRLF, a CR-only file with CR, and everything else (including a missing destination)
 * with LF. `.properties` is the Java and Spring format, so these files often live in CRLF
 * repositories, where a fixed LF joiner would turn a two-line translation change into a whole-file
 * diff on the first write. Values are unaffected either way: `\r` and `\n` inside a value are
 * escaped to `\\r` and `\\n`, so they never reach the joiner.
 */
export async function serializePropertiesEntries(
  entries: ReadonlyMap<string, TranslationEntry>,
  filePath: string,
): Promise<string> {
  const { items, terminator } = await readStructure(filePath);
  const emitted = new Set<string>();
  const lines: string[] = [];
  for (const item of items) {
    if (item.kind === "raw") {
      lines.push(item.text);
      continue;
    }
    const entry = entries.get(item.key);
    if (entry !== undefined && !emitted.has(item.key)) {
      lines.push(formatEntry(item.key, entry.value));
      emitted.add(item.key);
    }
  }
  for (const [key, entry] of entries) {
    if (!emitted.has(key)) {
      lines.push(formatEntry(key, entry.value));
    }
  }
  return lines.length === 0 ? "" : `${lines.join(terminator)}${terminator}`;
}
