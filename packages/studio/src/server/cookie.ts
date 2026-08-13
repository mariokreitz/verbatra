const COOKIE_PREFIX = "verbatra_studio_";

export function cookieName(port: number): string {
  return `${COOKIE_PREFIX}${port}`;
}

function splitCookiePairs(header: string): string[] {
  return header.split(";").map((pair) => pair.trim());
}

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

export function buildSetCookieHeader(name: string, value: string): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict`;
}
