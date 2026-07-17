---
"@verbatra/sdk": minor
"@verbatra/studio": minor
---

Studio's live-refresh SSE channel now reports a real, still-content-free key delta instead of a
blank "something changed" signal. `RefreshEvent` gains two optional fields, `locale` and `delta`
(`added`/`changed`/`removed` counts), populated for `"source"` and `"targets"` refresh events; a
`"lock"` event is unchanged. The `targets` watch category is now split into one chokidar watcher and
one debounce per configured target locale, so a change to one target locale's file is distinguishable
from a change to another, and each locale reports its own delta.

The delta is a plain content diff of one locale file against its own last observed snapshot (taken at
Studio startup and after every settled change), independent of source drift or the lock baseline.
This is a deliberate semantics choice: it is the only reading under which a translator hand-editing an
existing translation's wording, with the key itself untouched, is ever detected as a change. Two rapid
changes to the same locale file, close enough together that the second's debounce window opens while
the first's snapshot read is still in flight, are serialized so the second's reported delta is always
correct against the first's settled state, never a stale or out-of-order baseline.

`@verbatra/sdk` gains a new small read-only module, `readLocaleFileSnapshot` and
`diffLocaleSnapshots`, exported for this purpose: reading one locale file through the configured
adapter into a per-key content hash, and comparing two such snapshots into added/changed/removed
counts. No translation string, key name, or file content ever crosses the SSE wire, only locale codes
and counts.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump with no behavior
change of its own.
