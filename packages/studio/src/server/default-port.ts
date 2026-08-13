/**
 * The port Verbatra Studio binds when the caller does not name one. Fixed rather than negotiated so
 * the printed URL stays stable and bookmarkable between runs. There is no fallback if it is already
 * taken: startup fails with `PORT_IN_USE`, and the caller chooses another port or passes `0`.
 */
export const DEFAULT_STUDIO_PORT = 5849;

export function resolvePort(port: number | undefined): number {
  return port ?? DEFAULT_STUDIO_PORT;
}
