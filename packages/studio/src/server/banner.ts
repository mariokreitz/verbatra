/** Builds the one-time startup banner: the loopback URL with the bootstrap token attached as a query parameter. */
export function buildBanner(url: string, token: string): string {
  return `verbatra studio listening at ${url}?token=${token}`;
}
