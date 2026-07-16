---
"@verbatra/studio": minor
---

Add a Usage tab showing the most recently persisted run's token totals and, when a token budget
is configured, its ceiling, behavior, and whether it was reached. Backed by a new `usage.summary`
RPC method, an unconditional read like the needs-review queue's own view, projecting the
persisted run-status snapshot's run-wide `generatedAt`, `usage`, and `budget` fields unmodified.
Never shows a fabricated `0`: a token-less provider's absent usage and an unsupported budget each
render an explicit message instead. Displays the snapshot's own timestamp so it reads as "as of
the last recorded run", never a live counter, and re-fetches through the same live-refresh
plumbing every other panel already uses.
