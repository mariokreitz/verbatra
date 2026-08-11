---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Report the file line as well as the record number for a malformed row or duplicate key in a csv or tsv
import.

A delimited record that holds a quoted line break covers one spreadsheet row but several editor lines,
so the record number alone stopped matching what a translator saw in a text editor as soon as any
earlier row contained such a break. Both numbers are now reported and labelled: `row` is the record
number a spreadsheet shows, and the new optional `line` on `MalformedRowReport` and
`DuplicateKeyReport` is the file line the record starts on. The line is correct for LF, CRLF, and lone
CR breaks, and is derived from the same single scan of the file.

The CLI renders `row 4, line 7 (Status)` for a delimited import and the unchanged `row 4 (Status)` for
an xlsx one, which carries rows rather than lines and reports no `line` at all.
