---
"@verbatra/exchange": minor
"@verbatra/sdk": patch
---

Fix `exportWorkbook`'s `includeUnchanged` option labeling already up-to-date rows as `"changed"`.
`RowStatus` gains a third value, `"unchanged"`, and rows from the unchanged diff bucket are now
exported with that status instead of the misleading `"changed"`, which told translators the source
string had changed and needed re-translation even though it had not. The read-side row schema
accepts `"unchanged"` so a previously exported sheet round-trips through import without error, and
the instructions sheet gains an honest line explaining the new status. Import behavior is
unaffected: it already decides accept-or-withhold purely from source-hash drift, placeholder, and
ICU checks, never from the status column.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
is unchanged.
