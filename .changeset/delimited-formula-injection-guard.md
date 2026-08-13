---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Neutralize spreadsheet formula injection in the csv and tsv handoff. A value beginning with `=`,
`+`, `-`, or `@` is executed as a formula when the file is opened in Excel or Google Sheets, and the
exported `Current translation` and `Context` columns carry earlier provider output, which verbatra
treats as untrusted. The delimited writer now prefixes such a value with an apostrophe, the marker
spreadsheets read as "this cell is text". Quoting alone is not a defense: spreadsheets evaluate a
quoted formula too. The xlsx handoff was never affected, since it writes typed string cells.

The escape is reversed on import, so a translation still arrives exactly as it left. The two halves
are exact inverses: the writer also escapes a value that already begins with apostrophes followed
by a formula lead, so `'=1+1` is written as `''=1+1` and read back as `'=1+1`. A value whose
apostrophe does not lead a formula, such as `'tis`, is left alone in both directions.

Consumer impact: exported csv and tsv files gain a leading apostrophe on affected values, which is
visible in a text editor and invisible in a spreadsheet. One legacy edge exists. A csv or tsv
exported by an earlier version, holding a value that genuinely starts with an apostrophe followed
by a formula lead (`'=...`), loses that apostrophe when imported by this version, because the older
export did not escape it. Re-export the handoff before filling it in to avoid that. Values without
a leading formula character are unchanged in every direction.
