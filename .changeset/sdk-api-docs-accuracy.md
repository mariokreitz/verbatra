---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Correct factual errors in the published API documentation. No behavior or type-signature change;
the corrections ship in the generated declarations, so consumers reading the documented contract
get a different answer than before.

The substantive corrections: `translate` and `importWorkbook` no longer document a thrown
`LOCK_CONTENDED`, and `importWorkbook` no longer documents a thrown `CONFIG_INVALID`, because both
surface those codes on the affected locale's summary and let the other locales continue.
`translate`'s `LOCK_FILE_INVALID` is documented as aborting a live run after locales have started
rather than before any locale runs. The `degenerate` integrity-gate reason describes what is
actually detected (a large length blowup or runaway repetition) rather than an untranslated echo.
`SubBatchProgressEvent.batchIndex` is documented as 1-based, and the event as announcing an
attempt, since a batch withheld by an exhausted budget still emits. The `SdkFs` seam no longer
claims a custom implementation makes a run fully in-memory: locale files are read and written by
the format adapters outside the seam. Also corrected: `LocaleSummary.error` can be absent on a
failed locale, `DEFAULT_DELIMITED_PATH` names a directory, a delimited import accepts a single
file, `EQUALS_SOURCE` compares trimmed values, `watch` runs once immediately at startup, and the
read-only entry points document that a malformed target file surfaces the adapter's own parse
error unwrapped.
