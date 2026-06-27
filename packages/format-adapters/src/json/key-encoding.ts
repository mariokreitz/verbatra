/**
 * Encoding of a flattened dotted-path key so a literal dot inside one source key segment stays
 * distinguishable from the dot that separates nested path segments. Per segment, `\` becomes `\\`
 * and `.` becomes `\.`; the joining dot is never escaped, so splitting on unescaped dots and
 * unescaping each segment recovers the original text. A segment with no dot or backslash is returned
 * unchanged, so dotted-free keys produce map keys identical to the pre-encoding behavior.
 */

const BACKSLASH = "\\";
const DOT = ".";
const ESCAPED_BACKSLASH = "\\\\";
const ESCAPED_DOT = "\\.";

function needsEncoding(segment: string): boolean {
  return segment.includes(BACKSLASH) || segment.includes(DOT);
}

/** Escape a single key segment so a later unescaped-dot join keeps it atomic; an unaffected segment is returned unchanged. */
export function encodeSegment(segment: string): string {
  if (!needsEncoding(segment)) {
    return segment;
  }
  let out = "";
  for (const char of segment) {
    if (char === BACKSLASH) {
      out += ESCAPED_BACKSLASH;
    } else if (char === DOT) {
      out += ESCAPED_DOT;
    } else {
      out += char;
    }
  }
  return out;
}

function decodeSegment(segment: string): string {
  if (!segment.includes(BACKSLASH)) {
    return segment;
  }
  let out = "";
  let escaping = false;
  for (const char of segment) {
    if (escaping) {
      out += char;
      escaping = false;
    } else if (char === BACKSLASH) {
      escaping = true;
    } else {
      out += char;
    }
  }
  return out;
}

/** Join already-encoded segments into a single flattened key. */
export function joinEncodedSegments(segments: readonly string[]): string {
  return segments.join(DOT);
}

/** Split a flattened key on its unescaped dots and decode each segment back to its original literal text. */
export function decodeKeyToSegments(key: string): string[] {
  if (!key.includes(BACKSLASH)) {
    return key.split(DOT);
  }
  const segments: string[] = [];
  let current = "";
  let escaping = false;
  for (const char of key) {
    if (escaping) {
      current += BACKSLASH + char;
      escaping = false;
    } else if (char === BACKSLASH) {
      escaping = true;
    } else if (char === DOT) {
      segments.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (escaping) {
    current += BACKSLASH;
  }
  segments.push(current);
  return segments.map(decodeSegment);
}
