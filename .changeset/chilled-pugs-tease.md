---
"@verbatra/sdk": patch
---

Release every locale's write lock before `translate()` settles on a whole-run
failure.

With `concurrency` greater than 1, the locale pool awaited its workers with
`Promise.all`, which rejects on the first failure but does not stop the others.
A whole-run error (in practice a corrupt lock file, surfaced as
`LOCK_FILE_INVALID`) therefore rejected `translate()` while the remaining
workers were still inside their critical sections. Three things followed: their
lock files were still held when the caller unwound, and the CLI's synchronous
exit truncated the pending release, leaving orphaned locks that blocked the next
run for the full lock timeout, per locale, until someone deleted them by hand;
the pool kept pulling from the queue, so locales that had not started yet took
fresh locks, issued real provider calls and wrote their target files after the
run had already been reported as failed; and an SDK caller that caught the
rejection was wrong about both what was on disk and what had been billed.

The pool now records the failure instead of propagating it immediately. The
recorded reason doubles as an abort flag, so no worker claims another locale,
and the pool still awaits every in-flight worker so each one unwinds and
releases its lock before the error is re-thrown unchanged.

Note for SDK consumers: `translate()` now rejects after the slowest in-flight
locale finishes rather than instantly. The error, its code and the exit code are
unchanged, as is `concurrency: 1` and the isolation of ordinary per-locale
failures.
