export function isAllowedHost(hostHeader: string | undefined, port: number): boolean {
  if (hostHeader === undefined) {
    return false;
  }
  return hostHeader.toLowerCase() === `127.0.0.1:${port}`;
}

export function isAllowedOrigin(originHeader: string | undefined, port: number): boolean {
  if (originHeader === undefined) {
    return true;
  }
  return originHeader === `http://127.0.0.1:${port}`;
}
