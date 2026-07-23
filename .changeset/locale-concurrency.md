---
"@verbatra/sdk": minor
---

Add optional locale-level concurrency to the translate flow. `translate()` and `watch()` now accept an optional `concurrency` (a positive integer, surfaced on the CLI as `--concurrency <n>`), running up to that many target locales at once through a bounded worker pool. The default is 1, which stays strictly serial and byte-identical to before: same written files, same `RunSummary.locales` order, same lock-file content. Regardless of completion order, results are always collected back into source-locale order. Because a token budget's stop guarantee is order-dependent, a live run that sets `concurrency` greater than 1 while `maxTokens` is configured is refused up front with a `CONCURRENCY_BUDGET_CONFLICT` error (a dry run is exempt); an invalid value is rejected with `CONCURRENCY_INVALID`. No new locking is added: the per-locale write locks already isolate concurrent locales on disk.
