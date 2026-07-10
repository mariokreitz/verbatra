---
"@verbatra/sdk": patch
---

Reject a lock-file whose `version` does not match the version this build of verbatra
understands. `readLockFile` previously validated the lock-file's shape but never compared its
`version` field to the current supported version, so a lock-file written by an incompatible
future (or otherwise mismatched) verbatra build was read and reinterpreted as if it were the
current format, then rewritten still stamped with the wrong version, silently corrupting or
misinterpreting the recorded baselines. A version mismatch now throws the same structured
`LOCK_FILE_INVALID` error already used for a corrupt or oversized lock-file, naming the found and
expected version numbers.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own
behavior is unchanged.
