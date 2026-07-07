/**
 * The Host header must be exactly `127.0.0.1:PORT` (the host part compared case-insensitively).
 * `localhost` and `[::1]` are rejected on purpose: cookies are not port-scoped, so an alternate
 * hostname would dead-end in an authentication failure anyway, and an IPv6 Host on an IPv4-only
 * socket is dead surface. The printed 127.0.0.1 URL is the only supported entry point.
 */
export function isAllowedHost(hostHeader: string | undefined, port: number): boolean {
  if (hostHeader === undefined) {
    return false;
  }
  return hostHeader.toLowerCase() === `127.0.0.1:${port}`;
}

/**
 * Origin is only checked on state-changing (non-GET) requests. An absent Origin is allowed (many
 * same-origin navigations and non-browser clients omit it); a present Origin must match exactly,
 * including the literal string "null" for an opaque origin, which is rejected.
 */
export function isAllowedOrigin(originHeader: string | undefined, port: number): boolean {
  if (originHeader === undefined) {
    return true;
  }
  return originHeader === `http://127.0.0.1:${port}`;
}
