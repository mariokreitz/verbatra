/**
 * The content-addressed translation-memory (TM) cache: a local, gitignored, regenerable sidecar to
 * the lock file (`verbatra.cache.json`). It lets a translation whose source content is unchanged be
 * reused for free, even under a renamed key or across two keys with byte-identical source text,
 * instead of being re-sent to the provider.
 *
 * Nesting is `entries[fingerprint][targetLocale][contentHash] = value`. The fingerprint scopes every
 * entry to one translation context (provider, model, tone, glossary), so a tone or glossary change
 * never serves a stale value. Unlike the lock file, a corrupt or wrong-version cache degrades to an
 * empty cache and never fails a run: it is a cost optimization, not a correctness record.
 */
export interface TranslationMemory {
  /** The cache schema version; a value this build does not recognize degrades the whole file to empty. */
  readonly version: number;
  /** Cached values, nested fingerprint to target locale to source content hash to translated value. */
  readonly entries: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
  >;
}

/** One value to record into the TM for the run's fingerprint and a given target locale. */
export interface CacheAddition {
  /** The source entry's content hash under which this value is keyed. */
  readonly contentHash: string;
  /** The accepted translated value to cache. */
  readonly value: string;
}
