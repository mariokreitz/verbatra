---
"@verbatra/sdk": patch
---

Validate the watch session's concurrency at startup instead of on every cycle.

`watch()` passed `concurrency` straight through to each run and performed no
equivalent check of its own, so a session started with a value greater than 1
against a config that sets `maxTokens` started normally and then failed the
initial run, and every run after it, indefinitely, with
`CONCURRENCY_BUDGET_CONFLICT`. The same held for a concurrency that is not an
integer of at least 1, which produced `CONCURRENCY_INVALID` per cycle.

Both combinations are decidable from the arguments alone, so `watch()` now
resolves them once at startup, before the watcher is created. This is a
startup-validation improvement rather than a bug fix: the per-cycle failure was
documented and intended, it was simply reported later and repeatedly rather than
once and immediately.

Note for SDK consumers: `watch()` now rejects where it previously returned a
controller and surfaced the refusal through `onRun`. Callers that pass a
misconfigured combination see the error at the `await watch(...)` call site. The
CLI is unaffected in shape: `verbatra watch --concurrency 2` on a budgeted
config already rendered the structured error and exited non-zero, and still
does, just at startup.
