---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

A parse failure on a target locale file now names the file. `check`, `diff`, `export`, and every
other read of a target file used to surface the adapter's bare message, so a corrupt locale in a
twenty-locale project reported only `error [INVALID_JSON] The file is not valid JSON.` and left you
bisecting with `--locales` to find it. The message now reads
`The fr locale file at /app/locales/fr.json could not be read: The file is not valid JSON.` The
error type, its code, and the exit code are unchanged, so anything branching on `INVALID_JSON` keeps
working. This covers every adapter and every adapter error code, not just malformed JSON.

`doctor`'s source locale file check now reads and parses the file instead of only probing for its
existence. A directory standing in for the source file, an empty file, and malformed content used
to pass the check while making every other command fail; each is now reported, with the same
message `check` would give. When the configured format resolves to no adapter there is nothing to
parse with, so the check falls back to existence alone and says so. The check keeps its
`source-file` id and its place in the report.
