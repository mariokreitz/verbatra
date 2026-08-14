---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Two new entry points read and change a file-backed glossary: `readGlossaryFile` returns the current
terms straight from disk, and `updateGlossaryTerm` adds, replaces, or removes exactly one term and
returns the glossary as it now stands. Both take the `GlossaryProvenance` a loaded config reports
rather than a path, so the file they touch is always the one the config names.

Only a file-backed glossary can be changed. A glossary written inline in the config module is
refused with the new `GLOSSARY_NOT_FILE_BACKED` code rather than rewritten, and a failed write is
reported as the new `GLOSSARY_UNWRITABLE` code. A write takes a project-wide glossary lock for the
whole read-modify-write, replaces the file atomically, keeps the existing key order and indentation,
and is held to the same size and shape limits `loadConfig` enforces when it reads a glossary back.
