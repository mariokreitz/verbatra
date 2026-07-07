const COOKIE_PREFIX = "verbatra_studio_";

/**
 * The session cookie name for a given bound port. Cookies are not port-scoped by the browser, so
 * two Studio instances on different ports would otherwise clobber one another's session; suffixing
 * the port keeps each instance's cookie distinct.
 */
export function cookieName(port: number): string {
  return `${COOKIE_PREFIX}${port}`;
}

function splitCookiePairs(header: string): string[] {
  return header.split(";").map((pair) => pair.trim());
}

/** Reads the value of exactly the named cookie from a raw Cookie header, ignoring every other cookie present. */
export function readCookieValue(header: string | undefined, name: string): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  for (const pair of splitCookiePairs(header)) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    if (pair.slice(0, separatorIndex) === name) {
      return pair.slice(separatorIndex + 1);
    }
  }
  return undefined;
}

/**
 * Builds the Set-Cookie header for a successful bootstrap: HttpOnly, SameSite=Strict, scoped to
 * the whole app under Path=/, with no Secure flag (loopback only, never sent over TLS) and no
 * Max-Age or Expires so it lasts only for the browser session.
 */
export function buildSetCookieHeader(name: string, value: string): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict`;
}
