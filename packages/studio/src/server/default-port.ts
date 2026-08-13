export const DEFAULT_STUDIO_PORT = 5849;

export function resolvePort(port: number | undefined): number {
  return port ?? DEFAULT_STUDIO_PORT;
}
