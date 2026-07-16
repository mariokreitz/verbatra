---
"@verbatra/sdk": patch
---

Fix a duplicate-spend race in `translate()`: the lock-file was read exactly once before the
per-locale loop, so two concurrent `translate()` calls against the same project (two CLI
processes, or a CLI run overlapping a Studio write action) both diffed a "changed" key against
the same stale baseline and both sent it to the provider, paying twice for the same translation.
The lock-file is now read fresh inside each locale's own write lock on every non-dry-run call, so
a second concurrent call blocks on that locale's real lock, then re-reads a lock-file that already
reflects the first call's write and correctly finds nothing left to do. Dry-run is unaffected: it
still reads the lock once, since it never writes anything to serialize against. A corrupt
lock-file discovered on this path still aborts the whole run with `LOCK_FILE_INVALID`, matching
`translate()`'s existing documented behavior.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump with no behavior
change of its own.
