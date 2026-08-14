---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

A lock-file that turns corrupt while an import is running now aborts the whole run, exactly as it
already did during `verbatra translate`. `verbatra import` exits `2` instead of `1`, and
`importWorkbook()` rejects with `LOCK_FILE_INVALID` where it previously resolved with the corruption
recorded as one failed locale per sheet.

The lock-file is one shared file, so continuing bought no partial progress: every remaining locale
wrote its translations to disk and then failed to record them in the lock-file, leaving the project
looking up to date when it was not. Locales applied before the abort stay written; fix the lock-file
and import again.
