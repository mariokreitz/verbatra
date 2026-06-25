/**
 * Encoding of a flattened dotted-path key so a literal dot inside a single source key
 * segment is distinguishable from the dot that separates nested path segments.
 *
 * The scheme is a minimal backslash escape applied PER SEGMENT before segments are
 * joined with an unescaped `.`:
 *
 * - `\` becomes `\\`
 * - `.` becomes `\.`
 *
 * A segment that contains neither a dot nor a backslash is returned byte-for-byte
 * unchanged, so any project whose key segments contain no literal dot or backslash
 * produces map keys identical to the pre-encoding behavior. This is the property the
 * no-churn compatibility guarantee rests on: the encoding is a no-op for the common
 * case and only diverges for segments that actually contain a literal dot or backslash.
 *
 * The dot that joins segments is never escaped, so splitting a flattened key on
 * unescaped dots recovers the original segment list, and unescaping each segment
 * recovers the original literal text.
 */

const BACKSLASH = "\\";
const DOT = ".";
const ESCAPED_BACKSLASH = "\\\\";
const ESCAPED_DOT = "\\.";

/** True only for a segment that needs encoding; lets callers keep the no-op fast path. */
function needsEncoding(segment: string): boolean {
  return segment.includes(BACKSLASH) || segment.includes(DOT);
}

/**
 * Escape a single key segment so a later unescaped-dot join keeps it atomic. A segment
 * with no dot or backslash is returned unchanged (the no-churn property).
 */
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

/** Reverse {@link encodeSegment} for one already-split segment. */
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

/**
 * Split a flattened key on its unescaped dots and decode each segment back to its
 * original literal text. A key with no backslash is split on plain dots, so a key
 * produced by the pre-encoding behavior decodes to exactly the same segment list it
 * always did.
 */
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
