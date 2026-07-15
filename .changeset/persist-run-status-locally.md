---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

`translate` and `watch` now persist each non-dry-run's review-flag and token/usage
data to a new gitignored file, `.verbatra-local/run-status.json`, written once after
the per-locale loop completes. A new SDK function, `runStatus`, reads it back:
`{ available: false }` when no file exists yet or it cannot be parsed, or
`{ available: true, version, generatedAt, usage?, budget?, locales }` when it does.
The write is best-effort (any failure is caught and swallowed, never failing the run
or reaching `RunSummary`) and is skipped on dry-run, mirroring the existing lock-file
write discipline. `verbatra.lock.json` itself is unchanged.

`verbatra init` now also scaffolds `.verbatra-local/` into a project's `.gitignore`,
alongside the existing `.env`/`.env.local` entries.
