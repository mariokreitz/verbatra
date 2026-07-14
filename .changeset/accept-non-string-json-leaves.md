---
"@verbatra/sdk": minor
---

A JSON, YAML, or ARB locale file that contains a stray non-string leaf, such as `"count": 5`,
`"enabled": true`, or `"active": null`, no longer fails `translate`, `watch`, `check`, `diff`,
`import`, or `export` for the whole file. The non-string leaf is accepted as valid file structure,
excluded from the translatable set (never sent to a provider, hashed, diffed, or checked for
placeholder or ICU integrity), and every sibling string key in that file is read and translated
normally. This is a strict widening of what was previously rejected outright with
`INVALID_STRUCTURE`. A non-string leaf is not preserved if the same file is later rewritten by
verbatra: its path is silently absent from the output the next time that target file is written,
since the write path rebuilds the file purely from the translatable entries. This applies to every
JSON-family format (i18next, vue-i18n, next-intl, ngx-translate), YAML, and Flutter ARB.

Two smaller, unrelated correctness fixes ship on the same branch. `check` and `diff` findings from
`validate()` now sort by plain code-unit order instead of locale-sensitive `localeCompare`, so their
order no longer depends on the host's locale and always agrees with `diff()`'s own ordering for the
same key set. Writes to locale files are now crash-durable: the temp file is fsynced before the
rename that makes it visible, and the containing directory is fsynced (best-effort) after, closing a
window where a crash between the rename and disk flush could leave a target file renamed but empty
or corrupt.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump.
