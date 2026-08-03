---
"@verbatra/sdk": patch
---

Re-gate a fanned-out translation against the key it is written to.

Within-locale deduplication sends one representative per source content hash and
copies its accepted value onto every duplicate key. That copy skipped
`gateCandidateValue`, on the stated guarantee that an identical content hash
implies identical placeholder and ICU fields. It does not: the hash is computed
over canonicalized text (NFC-normalized, CRLF folded to LF) while the gate
compares placeholder tokens raw, so the hash is a lossy function of exactly the
bytes the gate inspects.

Two keys whose non-ASCII placeholder name differs only by Unicode normalization
form therefore hashed equal, and the representative's value was written to the
duplicate even though it fails that key's own placeholder check. The run
reported success: a fanned-out value makes no provider call so no review flag
fires, and the key was then locked in as correct and never re-attempted.

Each duplicate is now re-gated against its own source entry, and a rejection is
withheld as an integrity mismatch instead of written, so the key is re-attempted
on the next run. The check is pure and runs only for keys that actually have
duplicates, so the deduplication saving is unchanged and the ordinary
byte-identical case still costs one request.
