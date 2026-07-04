---
"@verbatra/sdk": patch
---

Fix Excel translation cells being type-coerced on import. The Translation column produced by `exportWorkbook` (and the SDK's workbook export) now carries an explicit text number format, so Excel treats whatever a translator types as literal text. Previously the column had no number format, so Excel's default "General" format silently coerced typed values: a leading-zero code like "007" lost its zero, a decimal like "1.10" lost its trailing zero, a value like "3/4" was reformatted as a date, a long numeric id lost precision or turned into scientific notation, and a value starting with "=", "+", "-", or "@" (for example a phone number or a note) was parsed as a formula and imported as its formula result or an error string instead of the intended text.
