# @verbatra/core

## 0.1.1

### Patch Changes

- c2871a9: fix(core): normalize Unicode (NFC) and line endings in the content hash

  `contentHash` fed text fields straight into the digest, so the same content in a different Unicode normalization form (precomposed vs decomposed, common on macOS) or with different line endings (CRLF vs LF, common from Windows editors or a git autocrlf checkout) produced a different hash. Diffing then reported a false "stale" and forced a needless re-translation.

  The value, description, meaning, and placeholder fields are now normalized to Unicode NFC with LF line endings before hashing, so content that is equal in meaning hashes equal. Pure-ASCII, LF content (the common case) is unaffected; entries that contained non-NFC characters or CRLF will re-hash once on the next run and may re-translate a single time as the lock file updates.

- 4fd6165: fix(core): compare placeholders as multisets so dropped or duplicated placeholders report as missing or extra instead of a mislabeled reorder

  `checkPlaceholders` now counts placeholder occurrences instead of collapsing them into sets. A dropped occurrence lands in `missing`, a surplus occurrence lands in `extra` (each carrying its multiplicity), and only a genuine same-multiset-different-order case is reported as `reordered`. The result shape is unchanged.

## 0.1.0

### Minor Changes

- bde1174: Add 'ngx-translate-json' to SupportedFormat, so the format-adapters package can declare an
  ngx-translate adapter. Additive only; existing format values are unchanged.
- 7aeaca7: Add the pure domain core: format-neutral model (TranslationEntry, LocaleResource,
  SupportedFormat) with zod schemas, deterministic per-entry content hash, resource diffing
  (missing/changed/orphaned/unchanged), placeholder-integrity comparison, and validation
  reporting. No I/O, no format- or provider-specific knowledge.
