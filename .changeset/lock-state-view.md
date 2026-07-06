---
"@verbatra/sdk": minor
---

Add `lockState`, a read-only sibling of `check` and `diff` that reports the translation lock-file's existence, version, and per-locale drift (recorded key count plus missing, stale, and up-to-date counts against the current source and target files) without calling a provider, writing any file, or touching the lock. Its `exists` field is always the result of an explicit check for the lock-file on disk, so a project that has never been translated is reported distinctly from one whose lock-file is present but empty.

Also export `loadLockFile`, a thin wrapper for reading the project's lock-file directly, along with the `LockFile` type and the `LOCK_FILE_NAME` constant. `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
