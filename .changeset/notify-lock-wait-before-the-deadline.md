---
"@verbatra/sdk": patch
---

Report a contended lock even when the acquire budget has already elapsed.

`onWait` is documented to fire once right after the first failed acquire, so a caller can render a
"still waiting" line. It did not fire at all when the acquire budget elapsed during that first
attempt: the deadline was checked before the notification, so the call threw `LOCK_CONTENDED`
having reported nothing, and a caller that had asked to be told about contention saw only the
failure.

The notification now runs before the deadline check. On the ordinary path nothing changes, because
the notifier already throttles a notice emitted moments after the previous one.

The CLI is unaffected, since `--lock-timeout` is taken in whole seconds and so never produces a
budget short enough to hit this. It is reachable from the SDK, where `lockAcquireTimeoutMs` accepts
any millisecond value.
