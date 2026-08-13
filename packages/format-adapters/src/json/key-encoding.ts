const BACKSLASH = "\\";
const DOT = ".";
const ESCAPED_BACKSLASH = "\\\\";
const ESCAPED_DOT = "\\.";

function needsEncoding(segment: string): boolean {
  return segment.includes(BACKSLASH) || segment.includes(DOT);
}

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

export function encodePathSegment(segment: string): string {
  if (!segment.includes(BACKSLASH)) {
    return segment;
  }
  return segment.replaceAll(BACKSLASH, ESCAPED_BACKSLASH);
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

export function joinEncodedSegments(segments: readonly string[]): string {
  return segments.join(DOT);
}

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

export function decodePathKey(key: string): string {
  return decodeKeyToSegments(key).join(DOT);
}
