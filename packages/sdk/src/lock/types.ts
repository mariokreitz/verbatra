/**
 * The lock-file shape. For each target locale, a map of key -> the SOURCE content hash
 * (core's contentHash) from which that target key was last translated. This is the
 * baseline core's diff consumes to detect changed source strings.
 */
export interface LockFile {
  readonly version: number;
  readonly locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** New per-key source hashes for one locale, produced after a successful translation. */
export type LockEntries = Readonly<Record<string, string>>;
