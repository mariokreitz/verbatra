/**
 * Returns a shallow copy of `record` with its keys sorted lexicographically, so a serialization or
 * fingerprint built over it is stable regardless of insertion order. Shared by the lock-file, the
 * translation-memory cache, and the glossary fingerprint, each of which needs the identical
 * sorted-key shape for a deterministic on-disk or hashed representation.
 */
export function sortRecordKeys<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));
}
