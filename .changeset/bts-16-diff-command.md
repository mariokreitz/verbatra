---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add a read-only `diff` command and the matching SDK `diff()` surface, the detailed sibling of `check`. Where `check` reports per-locale counts, `verbatra diff` reports the actual keys: per target locale it lists the keys that would be added (missing from the target), the keys that would be re-translated (the source changed since the target was last translated), and the keys that are orphaned (present in the target, absent from the source). It calls no provider, needs no API key, writes no files, and never touches the lock.

Exit codes make it CI-friendly: `0` when no locale has pending changes, `1` when at least one locale has a missing or changed key (the full per-locale report is still printed first), and `2` when the run could not start (a structured error to stderr, with stdout left clean for `--json` piping). Orphaned keys are always reported but never on their own flip the exit code, because a default `translate` run does not prune. Flags mirror the other commands: `--cwd`, `--config`, `--locales`, and `--json` (the JSON form is the SDK `DiffSummary` verbatim, with the full key lists).

The SDK exposes `diff(input, deps?)` returning a `DiffSummary` of `{ hasPendingChanges, locales }`, where each `LocaleDiff` carries `{ locale, missing, changed, orphaned, hasPendingChanges }`. Internally, `check` and `diff` now share a single read-plus-diff orchestration over the existing source read, adapter selection, lock baseline, and core `diffResources`, so there is one definition of drift in the codebase. The `check` public contract is unchanged.
