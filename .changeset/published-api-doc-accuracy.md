---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

`runStatus` now absorbs a file-system read that rejects, reporting `available: false` like every
other unusable status file. Its documented contract was already that the read is total and that the
call throws nothing, and `readTranslationMemory` already guarded the same call, but the run-status
read did not, so an injected `deps.fs` whose read rejected escaped to the caller.

Corrections to the published documentation, with no behavior attached:

- `editEntry` and `retranslateEntry` now say that the target locale file surfaces the adapter's own
  error on the write as well as on the read. The write raises one when the entries cannot be
  represented in the configured format, or when the existing destination file cannot be read back to
  be updated in place, and it is re-thrown unchanged so its code survives. The earlier wording
  implied the target read was the only unwrapped case, which sent callers into a
  `catch (e) { if (e instanceof SdkError) }` that missed the write path.
- `exportWorkbook` now documents that a failure to write the handoff itself propagates as the raw
  file-system error rather than as `TARGET_UNWRITABLE`, which is scoped to locale files.
- `RunSummary.locales` no longer claims configured target order for every producer. `translate` and
  `watch` keep that order; `importWorkbook` reports handoff order and appends the locales the
  handoff had nothing for.
- `SdkErrorCode` now carves `doctor` out of the `UNKNOWN_FORMAT` and `LOCALE_LAYOUT_INVALID`
  universals, matching the carve-outs it already documented for `CONFIG_NOT_FOUND`. `doctor` reports
  both as failed checks rather than throwing.
- `watch` now documents that a failure to construct the watcher escapes unwrapped at startup.
- `DoctorDeps.fs` now says it is threaded into the config loader, so it backs the glossary-file read
  as well as the source locale file.
