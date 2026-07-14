---
"@verbatra/sdk": patch
---

Fix a raw, uncaught exceljs crash when a target locale collided, case-insensitively, with another
target locale (for example `"de"` and `"DE"`) or with the reserved "Instructions" worksheet name
(for example a target locale of `"instructions"`). exceljs deduplicates worksheet names
case-insensitively inside its own `Worksheet` constructor, not in `addWorksheet`, so both cases
previously escaped as a raw library error instead of a structured one.

`targetLocales` is now validated at config-load time: two entries that are case-insensitively equal
are rejected with a clear zod error naming the colliding locale, matching the existing
source-locale-exclusion check. As defense in depth, `exportWorkbook` also rejects the same
collisions, and a locale colliding with the reserved instructions sheet, before any worksheet is
added, surfacing an `ExchangeError` (`WORKBOOK_INVALID`) instead of letting the exceljs error
propagate.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
is unchanged.
