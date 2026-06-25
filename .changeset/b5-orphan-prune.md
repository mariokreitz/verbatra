---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

feat: add opt-in orphan pruning (`--prune`)

Pruning is off by default and never deletes translator work silently. Enable it with the new
`translate --prune` flag or a `prune: true` option in the config (the flag takes precedence per run).
When on, verbatra removes exactly the orphaned keys (present in a target file but absent from the
source) from the written target file and the lock; no other key is ever touched. Combine
`--prune --dry-run` to preview which keys would be removed without writing anything. The run summary
(human and `--json` / watch NDJSON) reports a per-locale pruned count and key list alongside the
existing orphaned reporting.
