---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Export `EXCHANGE_FORMATS` and `DEFAULT_EXCHANGE_FORMAT` from the SDK.

`EXCHANGE_FORMATS` lists every translator-handoff format at runtime (`xlsx`, `csv`, `tsv`) and
`DEFAULT_EXCHANGE_FORMAT` names the one `exportWorkbook` and `importWorkbook` use when the caller
passes none. Until now the SDK published only the `ExchangeFormat` type, so anything validating a
`--format` argument had to restate the members, and a plain `readonly ExchangeFormat[]` accepts a
subset without complaint: a format added to the SDK would have been rejected by such a check with no
compile error to catch it. The new export is built from a record keyed by the format type itself, so
a member missing from the list is a compile error.

The CLI now takes both the accepted values and the default from these exports, which also removes
the duplicated format list from the `export` and `import` help text. That text now reads
`handoff format: one of xlsx, csv, tsv (default xlsx)`.
