/**
 * The port Verbatra Studio listens on when the caller does not specify one. Chosen once so the
 * printed URL is stable and bookmarkable; there is no fallback to another port if it is busy.
 */
export const DEFAULT_STUDIO_PORT = 5849;

/** Resolves the port to bind: the given port when set (including 0 for an OS-assigned port used in tests), or the default. */
export function resolvePort(port: number | undefined): number {
  return port ?? DEFAULT_STUDIO_PORT;
}
