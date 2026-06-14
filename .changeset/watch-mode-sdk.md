---
"@verbatra/sdk": minor
---

Add watch mode: a long-running wrapper over the one-shot translate flow. It watches the configured
source file, debounces filesystem events (300 ms default, configurable), and re-runs the existing
one-shot `translate()` on each settled change. Runs are serialized and coalesced through an
IDLE/RUNNING state machine with a single boolean pending-rerun flag: a change during a run never
starts a concurrent run, and any number of mid-run changes collapse into exactly one immediate
follow-up (no fresh debounce). Watch adds no translation, diff, or lock logic of its own — each run
is the slice-1 flow unchanged, so the lock-file and per-locale atomic writes are reused as-is. An
initial run happens on startup; a missing source path at startup is a hard `SOURCE_UNREADABLE`
error, while a run that fails after start is reported and watching continues. Run summaries and
failures are surfaced through a caller-supplied `onRun` callback (the SDK does no logging and puts
no secret on the output path); the failed result carries only a secret-free `{code, message}`. The
returned controller exposes `stop()`, which stops accepting triggers, discards any pending
follow-up, closes the watcher, and awaits the in-flight run to completion (signal wiring such as
SIGINT lives in the cli wrapper, not the SDK). New dependency: `chokidar` (pinned exact).
