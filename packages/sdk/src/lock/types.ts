/**
 * The contents of `verbatra.lock.json` (see {@link LOCK_FILE_NAME}), the baseline that makes
 * staleness detectable. For each locale it records the hash of the source text each key was
 * translated from, so a later run can tell a translation that is merely present from one that is
 * still current.
 *
 * Commit it: without it, every run has to treat an existing translation as up to date and a source
 * edit would silently never be re-translated.
 */
export interface LockFile {
  /** The lock-file schema version. An unrecognized version is rejected rather than guessed at. */
  readonly version: number;
  /** Per locale, the source-content hash recorded for each translated key. */
  readonly locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export type LockEntries = Readonly<Record<string, string>>;
