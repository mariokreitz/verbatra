---
"@verbatra/studio": minor
---

Resolve locale file paths through the SDK's `createLocalePathResolver` instead of Studio's own copy
of the substitution. The live-refresh watcher and the history view now honor the project's
`files.localeStyle`, so a project on the `"posix"` or `"android"` layout is watched and reported at
the paths it actually writes.
