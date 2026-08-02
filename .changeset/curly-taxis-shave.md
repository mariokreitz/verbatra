---
"@verbatra/sdk": patch
---

Leave a cache file with an unrecognized version on disk instead of downgrading
it.

`readTranslationMemory` degrades an unrecognized-version cache to an empty
memory, which is the correct and documented read contract. But the end-of-run
write replaces the whole file, so a cache written by a newer verbatra was
silently destroyed and relabelled with this build's version, keeping only the
current run's entries. The same happened through `editEntry`,
`retranslateEntry` and `importWorkbook`.

The read now also reports whether the file may be written, and the write paths
honour it. The distinction is narrow on purpose: only a structurally valid file
whose `version` is unrecognized is preserved. A missing file is still created, a
corrupt, schema-invalid or oversized one is still overwritten so the cache
self-heals rather than wedging, and a `version` of zero, negative or
non-integer fails the schema's positive-integer check and is treated as
corruption.

The run itself is unaffected: it proceeds with an empty effective cache,
succeeds, and its exit code and summary shape are unchanged. It does report a
`CACHE_VERSION_UNRECOGNIZED` notice, because the alternative is a mistyped
version disabling caching permanently with no signal at all.

This adds `CACHE_VERSION_UNRECOGNIZED` as an additive member of the exported
`SdkNoticeCode` union on `@verbatra/sdk`. The behavior fixed is a defect, so the
bump stays patch, but the addition to the public type is called out here as
deliberate, exactly as `BLANK_ROW_BASELINE_RETAINED` was in 0.4.4. `writable` is
returned alongside the memory rather than added to it, so the exported
`TranslationMemory` type is unchanged.
