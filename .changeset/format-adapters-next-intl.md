---
"@verbatra/format-adapters": minor
---

Add the next-intl JSON adapter (createNextIntlJsonAdapter), registered in the default registry.
It parses ICU MessageFormat values to extract argument and rich-text tag placeholders without
resolving them, sets isPlural from a plural/selectordinal argument, and reports values that fail
to parse via invalidIcuKeys; the ICU body is kept verbatim on round-trip. ICU parsing uses
@formatjs/icu-messageformat-parser (the canonical FormatJS parser next-intl builds on) and is
bounded — a value too deep or malformed is reported as invalid, never thrown. Internally, the
shared adapter shell was extracted into createJsonFileAdapter and the i18next and vue-i18n
adapters were reimplemented on it (no behavior change).
