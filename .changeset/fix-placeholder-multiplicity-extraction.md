---
"@verbatra/format-adapters": patch
---

fix(format-adapters): preserve placeholder multiplicity so dropped or duplicated placeholders are caught

The i18next, vue-i18n, ngx-translate, and next-intl extractors previously deduplicated placeholders with a `Set` before returning them. That collapsed `{{count}} of {{count}}` to a single occurrence and silently defeated core's multiset integrity check: a translation that dropped one required occurrence (for example `{{count}} total`) passed integrity and was written.

Extractors now return every occurrence in document order. Combined with `checkPlaceholders` (already multiset-aware), a dropped or duplicated placeholder is now reported as `missing`/`extra`. ICU message bodies are preserved verbatim by translation, so an occurrence missing from one plural/select branch is likewise reported as a mismatch. Closes the C1 finding from the full-stack audit (#19, #20).
