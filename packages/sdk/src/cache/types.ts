/**
 * The on-disk translation memory, read from and written to `verbatra.cache.json` (see
 * {@link CACHE_FILE_NAME}). A run consults it before calling the provider, so a string that was
 * already translated under the same configuration is reused instead of paid for again.
 *
 * Entries are keyed by configuration fingerprint, then locale, then source-content hash. The
 * fingerprint layer means that changing the provider, model, tone, or glossary does not silently
 * reuse translations produced under the old settings; those entries simply stop matching.
 */
export interface TranslationMemory {
  /** The cache schema version. A file at an unrecognized version is ignored rather than trusted. */
  readonly version: number;
  /** Cached values, nested as configuration fingerprint, then locale, then source-content hash. */
  readonly entries: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
  >;
}

export interface CacheAddition {
  readonly contentHash: string;
  readonly value: string;
}
