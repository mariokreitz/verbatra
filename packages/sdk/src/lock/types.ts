/**
 * The lock-file shape: for each target locale, a map of key to the source content hash from which that
 * target key was last translated. The baseline core's diff consumes to detect changed source strings.
 */
export interface LockFile {
  readonly version: number;
  readonly locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** New per-key source hashes for one locale, produced after a successful translation. */
export type LockEntries = Readonly<Record<string, string>>;
