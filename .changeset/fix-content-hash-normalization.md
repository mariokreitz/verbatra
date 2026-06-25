---
"@verbatra/core": patch
---

fix(core): normalize Unicode (NFC) and line endings in the content hash

`contentHash` fed text fields straight into the digest, so the same content in a different Unicode normalization form (precomposed vs decomposed, common on macOS) or with different line endings (CRLF vs LF, common from Windows editors or a git autocrlf checkout) produced a different hash. Diffing then reported a false "stale" and forced a needless re-translation.

The value, description, meaning, and placeholder fields are now normalized to Unicode NFC with LF line endings before hashing, so content that is equal in meaning hashes equal. Pure-ASCII, LF content (the common case) is unaffected; entries that contained non-NFC characters or CRLF will re-hash once on the next run and may re-translate a single time as the lock file updates.
