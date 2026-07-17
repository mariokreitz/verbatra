---
"@verbatra/studio": minor
---

Studio's live-refresh toast now renders. Previously the SSE channel already carried a `locale`
and a per-key `delta` (added/changed/removed counts) on every `"source"`/`"targets"` refresh
event, but the client discarded both fields and nothing rendered them. A toast now appears for
any event carrying a nonzero delta, showing which category changed and a summary built from the
nonzero counts, with a manual dismiss.

A `"source"`-reason toast (the source locale file drifted) also gets a "translate pending changes
across all locales" action, gated on `--allow-spend`: a new RPC method,
`translation.translatePending`, wraps the sdk's unfiltered `translate()`, the exact whole-project
call `verbatra translate` already performs. A `"targets"`-reason toast (a target locale file's own
content changed) never gets this action: `translate()`'s diff cannot see most target-content
changes, so the action would either do nothing or spend on unrelated drift; the existing
key-scoped retranslate action is the right tool for a bad target value.

The new action is gated the same way as the existing retranslate action (`spend`), has its own
dispatch-layer rate limit sized for its whole-project blast
radius, and a process-wide in-flight guard answers a second overlapping call with a structured
`ALREADY_IN_PROGRESS` (409) immediately instead of leaving it to block on the real per-locale
lock. `StudioServerOptions` gains `translatePendingRateLimitWindowMs`/`translatePendingRateLimitMax`
overrides, following the existing `retranslateRateLimitWindowMs`/`Max` pattern.

`client/reconnect.ts`'s `parseRefreshEvent` now parses and passes through `locale` and `delta`,
additive to its existing `{ reason, at }` parsing; a malformed field degrades to absent rather
than dropping the frame. No change to the SSE wire format itself, which already carried both
fields.
