---
"@verbatra/sdk": minor
---

feat(sdk): split a locale's translation request into bounded sub-batches

A locale's missing-plus-changed entries are now divided into sequential sub-batches no larger than a
configured maximum, and each sub-batch is sent as its own provider request. A locale whose entry
count is at or below the maximum still issues exactly one request, so the common case is unchanged.
The accepted translations from every sub-batch are merged into one target file and written once, so
the on-disk result for a multi-sub-batch locale is identical to what a single un-chunked request
would have produced for the same accepted set.

The maximum is a new optional config field, `maxBatchSize`: a positive integer validated at the
config boundary (zero, a negative number, a non-integer, or a non-number is rejected with a
structured config error). When the field is absent the documented default of 50 applies. The field
is config-only for this slice; no CLI flag is added.

A failed sub-batch no longer sinks the locale. If a sub-batch's provider call throws, or its results
fail integrity, only that sub-batch's keys are withheld (not locked, so they are retried next run)
while the remaining sub-batches are still merged, written, and locked. The locale's overall status
stays `succeeded`, and a chunk-level provider failure surfaces as a concise, secret-free
`SUB_BATCH_FAILED` notice on the locale summary rather than throwing. The raw provider error is never
bound or surfaced. This is a behavior change for the provider-throw path: a thrown provider call
previously failed the whole locale, and now isolates to the affected sub-batch's keys.

Compatibility: projects whose locales fit within the default in a single request behave exactly as
before. Lock-file format and semantics are unchanged.
