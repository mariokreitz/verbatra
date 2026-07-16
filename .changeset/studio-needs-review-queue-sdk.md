---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add `editEntry`, a new sdk seam that writes exactly one human-typed correction into exactly one
target locale: gated through the shared `gateCandidateValue` accept/reject check before anything
reaches disk, wrapped in `withLocaleWriteLock` across read-target through lock-update, mirroring
`retranslateEntry`'s own critical section exactly. Unlike `retranslateEntry`, it never calls a
provider: `EditEntryDeps` carries no `createProvider` field, so there is no path to one even if the
seam were miswired. On acceptance it writes the target locale file (merging only the requested key)
and updates the lock entry for that key; on rejection it writes nothing and reports the candidate
value and which check failed it. Never writes to, or reads for the purpose of updating,
`.verbatra-local/run-status.json`.

Add `keyValue`, a new read-only sdk function that reads a key's current source and target value for
exactly one target locale, live via the same `readSource`/`readTarget` calls `check`, `diff`,
`retranslateEntry`, and `editEntry` already use. `target` is absent exactly when the key does not
yet exist in that target locale. No provider call, no file write, no lock.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
is unchanged.
