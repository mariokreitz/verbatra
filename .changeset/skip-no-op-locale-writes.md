---
"@verbatra/sdk": patch
---

Leave a target locale file untouched when a run changes nothing in it.

`translate` rewrote every target file on every run, even when nothing was translated, pruned or
generated. The content was identical, so the change was invisible in git for a file already in
verbatra's formatting, but the write still replaced the file: the inode and mtime changed on every
run, which retriggers third-party file watchers (Vite, webpack, a framework dev server) for no
reason, and a hand-formatted target was reformatted to canonical form the first time.

That reformatting is the case that could actually fail a build. A drift check that runs
`verbatra translate` and then `git diff --exit-code` would report a change on a project whose
locale files were formatted by hand, even though no translation happened.

The write is now skipped when nothing was accepted, pruned or generated, and the target already
exists. The existing-target condition matters: a first run for a new locale also accepts nothing
when there is nothing to translate, and the file must still be created there, or a later `import`
of that locale would fail on a missing file rather than reading an empty one.

Nothing else changes. Lock-file entries, the translation-memory cache and the run summary are all
computed exactly as before, so a skipped write never hides a key from the summary or the lock file.
