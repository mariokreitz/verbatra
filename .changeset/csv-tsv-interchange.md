---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add a CSV and TSV translator interchange alongside the Excel workbook.

`export` and `import` take a `--format` flag (`xlsx` by default, plus `csv` and `tsv`), and the SDK's
`exportWorkbook` and `importWorkbook` take the matching optional `format` field. Passing no format
keeps the existing xlsx behavior exactly as it was.

A delimited export writes one `<locale>.csv` or `<locale>.tsv` per target locale, so `--out` names a
directory for those formats (default `verbatra-translations`) and stays a file path for `xlsx`. The
directory is created if it is missing. Import accepts either that directory or a single interchange
file, and takes the locale from the file name. Files carry the same columns as the workbook, are
written with LF line endings (and a UTF-8 BOM for `csv`, which Excel needs), and are quoted per
RFC 4180, so a value containing the delimiter, a quote, a line break, or padding whitespace
round-trips exactly.

Every imported row runs the same source-drift, placeholder, and ICU gate as the workbook path. A
delimited file has no cell protection, so its source-hash column is visible and editable: an edited
or blanked hash is never trusted, the row is withheld as drift and reported. Parsing is bounded by
explicit input-byte, row, field-count, and field-length caps, and a malformed row or a duplicate key
is reported per row instead of aborting the file.
