# Hardening backlog

Tracked, non-blocking hardening items deferred from a completed review chain. Each was
assessed as low-risk and fail-safe; recorded here so it is not lost.

## format-adapters: target-file write is non-atomic

The format adapters write a target locale file with a plain `writeFile` (truncate-in-place).
A crash mid-write could truncate a target file. It fails safe — a truncated file is caught on
the next run as a malformed file (the adapter's structured rejection), so no silently-wrong
translation is produced — and it is a different package that already cleared its full review
chain, so it is out of the SDK slice's scope.

Fix: atomic write (write to a temp file in the same directory, then rename over the target),
parity with the SDK lock-file write. Deferred to an adapter-side hardening pass.
