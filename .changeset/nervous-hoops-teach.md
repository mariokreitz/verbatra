---
"@verbatra/sdk": patch
---

Report every blank workbook row that still needs a translation as `unfilled`.

A blank row was recorded into `summary.locales[].unfilled` only when the row had
been exported with status `changed`. A never-translated key exports as `new`, so
the most common unfilled case of all, a first handoff where every row is new,
reported nothing: importing an entirely untouched workbook gave `unfilled: []`
and a clean success, with no inventory of the pending work.

Membership is now decided by the import-time diff rather than by the status
string recorded in the exported row, so a blank row for a key that still needs a
translation is reported whether it was exported as `new` or `changed`. A row
exported as `changed` whose key has since stopped needing work is correspondingly
excluded.

No exit code moves. `unfilled`, `malformedRows` and `duplicateKeys` still do not
feed a locale's status, which is a settled decision now recorded in the summary
type's own documentation rather than left to be rediscovered: `check` and `diff`
already answer "is this project fully translated", failing on unfilled work
would break the locale-at-a-time handoff, and a malformed row is decided on its
Status cell alone, so that bucket cannot distinguish dropped work from absent
work in the first place.
