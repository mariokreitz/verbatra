---
"@verbatra/sdk": patch
---

Fix the workbook decompressed-byte guard over-counting binary parts on import. The guard measured
each entry's decompressed size by re-encoding the entry's UTF-8-decoded text with
`Buffer.byteLength`, but decoding is lossy for a binary part (a thumbnail, embedded image, or any
non-UTF-8 workbook part): every invalid byte becomes the replacement character U+FFFD, which is 3
bytes wide, so the re-encoded count could overstate the true decompressed size by up to roughly 3x.
A legitimate translated workbook carrying such a part could be wrongly rejected with a
`WORKBOOK_INVALID` error even though it never actually exceeded the configured limit. The guard now
sums the true raw decompressed byte count as it streams each entry, so the cap is checked against
what the entry actually decompresses to.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
is unchanged.
