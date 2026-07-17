---
"@verbatra/studio": minor
---

Add a live needs-review queue to Verbatra Studio: a new Review page listing every `(locale, key)`
pair the most recent CLI run flagged for human review, backed by a new unconditional read RPC
method, `review.queue`, that passes through the sdk's existing `runStatus()` result with no new
computation. Each row shows a distinct, human-readable label for its `ReviewReasonCode`s; an
unavailable snapshot (no run has been recorded yet) renders an informational empty state, never an
error.

Each row also gets three actions: Approve and Reject are purely client-side dismissals, held in
an in-memory "actioned this session" overlay that survives the existing SSE `refresh`-triggered
re-fetch and resets only on a page reload, never persisted to disk or the lock file. Edit opens a
dialog that fetches the key's current source and target through a new RPC method, `key.value`,
then submits a correction through a new RPC method, `translation.editEntry`. Both methods
register unconditionally, need no capability flag, never call a provider, and are independent of
`--allow-spend`. `translation.editEntry` gets its own dispatch-layer rate limit, reusing the
existing rate-limiter mechanism already built for `translation.retranslateEntry`.

All new UI reuses the existing badge, data-table, drawer, and retranslate-action design tokens and
component patterns; no new CSS custom property is introduced. No change to Excel export or import,
or to any code under `packages/exchange`.
