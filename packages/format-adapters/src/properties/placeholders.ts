/**
 * The MessageFormat argument types whose style is a set of nested sub-messages rather than a plain
 * format string. Their sub-message text is translatable, so the extractor emits a header token for
 * the argument itself and recurses into the sub-messages for any nested arguments, instead of
 * capturing the whole (translatable) body as one opaque token.
 */
const SUBMESSAGE_TYPES = new Set(["plural", "select", "selectordinal", "choice"]);

/** A MessageFormat argument name is a non-negative index or a Java-style identifier. */
const ARGUMENT_NAME = /^(?:\d+|[A-Za-z_$][\w$-]*)$/;

interface ParsedArgument {
  readonly name: string;
  readonly type: string | null;
  /** Absolute index where the style begins, or -1 when the argument has no style. */
  readonly styleStart: number;
}

/**
 * For every `{` in the value, the index of the `}` that closes it, or -1 when it is unbalanced,
 * computed in a single left-to-right pass with an open-brace stack. Precomputing all matches once
 * replaces a per-`{` rescan to end-of-string, so extraction stays linear in the value length even on
 * adversarial input such as a long run of unbalanced open braces.
 */
function matchingBraces(value: string): Int32Array {
  const close = new Int32Array(value.length).fill(-1);
  const open: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "{") {
      open.push(i);
    } else if (char === "}") {
      const start = open.pop();
      if (start !== undefined) {
        close[start] = i;
      }
    }
  }
  return close;
}

/**
 * Scan the name region [from, limit) for the comma that ends the name, bailing at the first brace,
 * which can never be part of a valid name. Bailing early keeps a brace-laden body from being sliced
 * once per enclosing `{`, which is what would otherwise be quadratic.
 */
function findNameEnd(
  value: string,
  from: number,
  limit: number,
): { readonly comma: number; readonly hasBrace: boolean } {
  for (let i = from; i < limit; i += 1) {
    const char = value[i];
    if (char === ",") {
      return { comma: i, hasBrace: false };
    }
    if (char === "{" || char === "}") {
      return { comma: -1, hasBrace: true };
    }
  }
  return { comma: -1, hasBrace: false };
}

/**
 * Parse the MessageFormat argument whose braces span `open`..`close` into its name, optional type,
 * and optional style start, or null when it is not a valid argument. The name runs to the first
 * comma, the type to the second; the style is the remainder up to the closing brace.
 */
function parseArgumentAt(value: string, open: number, close: number): ParsedArgument | null {
  const { comma, hasBrace } = findNameEnd(value, open + 1, close);
  if (hasBrace) {
    return null;
  }
  const nameEnd = comma === -1 ? close : comma;
  const name = value.slice(open + 1, nameEnd).trim();
  if (!ARGUMENT_NAME.test(name)) {
    return null;
  }
  if (comma === -1) {
    return { name, type: null, styleStart: -1 };
  }
  const secondComma = value.indexOf(",", comma + 1);
  if (secondComma === -1 || secondComma >= close) {
    return { name, type: value.slice(comma + 1, close).trim(), styleStart: -1 };
  }
  return { name, type: value.slice(comma + 1, secondComma).trim(), styleStart: secondComma + 1 };
}

/** The canonical token for a non-sub-message argument: name, plus type and style when present. */
function canonicalToken(value: string, arg: ParsedArgument, close: number): string {
  if (arg.type === null) {
    return `{${arg.name}}`;
  }
  if (arg.styleStart === -1) {
    return `{${arg.name},${arg.type}}`;
  }
  return `{${arg.name},${arg.type},${value.slice(arg.styleStart, close).trim()}}`;
}

function emitArgument(
  value: string,
  close: Int32Array,
  arg: ParsedArgument,
  closeIndex: number,
  out: string[],
): void {
  if (arg.type !== null && SUBMESSAGE_TYPES.has(arg.type)) {
    out.push(`{${arg.name},${arg.type}}`);
    if (arg.styleStart !== -1) {
      scanRange(value, close, arg.styleStart, closeIndex, false, out);
    }
    return;
  }
  out.push(canonicalToken(value, arg, closeIndex));
}

/**
 * Walk [start, end), appending a token for every argument and recursing into sub-messages. At the
 * message top level a `{{` pair is a literal double-brace escape and is skipped; inside a sub-message
 * it is not, since a sub-message may open directly onto an argument (`one {{name}...}`).
 */
function scanRange(
  value: string,
  close: Int32Array,
  start: number,
  end: number,
  topLevel: boolean,
  out: string[],
): void {
  let i = start;
  while (i < end) {
    if (value[i] !== "{") {
      i += 1;
      continue;
    }
    if (topLevel && value[i + 1] === "{") {
      i += 2;
      continue;
    }
    const closeIndex = close[i] ?? -1;
    if (closeIndex === -1 || closeIndex >= end) {
      i += 1;
      continue;
    }
    const arg = parseArgumentAt(value, i, closeIndex);
    if (arg === null) {
      i += 1;
      continue;
    }
    emitArgument(value, close, arg, closeIndex, out);
    i = closeIndex + 1;
  }
}

/**
 * Extract the java.text.MessageFormat argument references from a `.properties` value, the syntax
 * such files are consumed through. Recognizes the plain form ({0}, {name}), the typed form
 * ({0,number}, {0,date}) and the styled form ({0,number,integer}, {0,date,short}); an argument's
 * type and style are part of the token, so altering them is a mismatch. Sub-message types (plural,
 * select, selectordinal, choice) emit a header token ({count,plural}) and recurse into their
 * sub-messages for nested arguments, so translating the branch text stays a match while dropping or
 * renaming the argument does not. Every occurrence is preserved (not deduplicated), since
 * placeholder integrity is a multiset. A top-level double-brace literal ({{...}}) is not extracted.
 * Extraction is a single precompute of the brace matches plus a linear scan, so it stays linear in
 * the value length even on adversarial (deeply unbalanced or deeply nested) input.
 *
 * Known limitation: MessageFormat single-quote quoting is not interpreted, so a quoted literal
 * (`'{0}'`) is still read as an argument, and a stray double-close (`{0}}`) reads the inner `{0}`.
 * These are treated this way deliberately, so that ordinary apostrophes in translated text never
 * swallow a following placeholder.
 */
export function extractPropertiesPlaceholders(value: string): readonly string[] {
  const out: string[] = [];
  scanRange(value, matchingBraces(value), 0, value.length, true, out);
  return out;
}
