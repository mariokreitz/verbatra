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
  readonly style: string | null;
  /** Index in the source just past the argument's closing brace. */
  readonly end: number;
}

/** Index of the brace that closes the one opened at `open`, or -1 when the braces are unbalanced. */
function matchBrace(message: string, open: number): number {
  let depth = 0;
  for (let i = open; i < message.length; i += 1) {
    const char = message[i];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Split the text between an argument's braces into its name, optional type, and optional style. The
 * name runs to the first comma, the type to the second; the style keeps the remainder verbatim
 * (it may itself contain commas and braces). Returns null when the name is not a valid argument name.
 */
function parseArgumentBody(
  body: string,
): { readonly name: string; readonly type: string | null; readonly style: string | null } | null {
  const firstComma = body.indexOf(",");
  if (firstComma === -1) {
    const name = body.trim();
    return ARGUMENT_NAME.test(name) ? { name, type: null, style: null } : null;
  }
  const name = body.slice(0, firstComma).trim();
  if (!ARGUMENT_NAME.test(name)) {
    return null;
  }
  const rest = body.slice(firstComma + 1);
  const secondComma = rest.indexOf(",");
  if (secondComma === -1) {
    return { name, type: rest.trim(), style: null };
  }
  return { name, type: rest.slice(0, secondComma).trim(), style: rest.slice(secondComma + 1) };
}

/** Read a whole MessageFormat argument starting at the `{` in `open`, or null when it is not one. */
function readArgument(message: string, open: number): ParsedArgument | null {
  const close = matchBrace(message, open);
  if (close === -1) {
    return null;
  }
  const body = parseArgumentBody(message.slice(open + 1, close));
  return body === null ? null : { ...body, end: close + 1 };
}

/** The canonical token for a non-sub-message argument: name, plus type and style when present. */
function canonicalToken(arg: ParsedArgument): string {
  if (arg.type === null) {
    return `{${arg.name}}`;
  }
  if (arg.style === null) {
    return `{${arg.name},${arg.type}}`;
  }
  return `{${arg.name},${arg.type},${arg.style.trim()}}`;
}

function emitArgument(arg: ParsedArgument, out: string[]): void {
  if (arg.type !== null && SUBMESSAGE_TYPES.has(arg.type)) {
    out.push(`{${arg.name},${arg.type}}`);
    if (arg.style !== null) {
      scanMessage(arg.style, out, false);
    }
    return;
  }
  out.push(canonicalToken(arg));
}

/**
 * Walk a message, appending a token for every top-level argument and recursing into sub-messages.
 * At the message top level a `{{` pair is a literal double-brace escape and is skipped; inside a
 * sub-message it is not, since a sub-message may open directly onto an argument (`one {{name}...}`).
 */
function scanMessage(message: string, out: string[], topLevel: boolean): void {
  let i = 0;
  while (i < message.length) {
    if (message[i] !== "{") {
      i += 1;
      continue;
    }
    if (topLevel && message[i + 1] === "{") {
      i += 2;
      continue;
    }
    const arg = readArgument(message, i);
    if (arg === null) {
      i += 1;
      continue;
    }
    emitArgument(arg, out);
    i = arg.end;
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
 *
 * Known limitation: MessageFormat single-quote quoting is not interpreted, so a quoted literal
 * (`'{0}'`) is still read as an argument, and a stray double-close (`{0}}`) reads the inner `{0}`.
 * These are treated this way deliberately, so that ordinary apostrophes in translated text never
 * swallow a following placeholder.
 */
export function extractPropertiesPlaceholders(value: string): readonly string[] {
  const out: string[] = [];
  scanMessage(value, out, true);
  return out;
}
