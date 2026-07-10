---
"@verbatra/sdk": patch
---

Fix reading a UTF-8 JSON or ARB translation file that starts with a leading byte-order-mark
(U+FEFF). The shared bounded file reader decoded the raw bytes to a UTF-8 string but never
stripped a leading BOM, so any JSON-based format (including ARB) reading a BOM-prefixed file
failed with an `INVALID_JSON` error even though the file was otherwise valid. Exactly one leading
BOM is now stripped once, in the shared read layer, before content ever reaches a parser; interior
BOM characters and everything else in the file are left untouched, and the fix is bounded and
fixed-length rather than a regex. No adapter's write path emits a BOM, so a file without one stays
unchanged on round-trip.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own
behavior is unchanged.
