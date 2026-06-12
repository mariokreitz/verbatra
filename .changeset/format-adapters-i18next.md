---
"@verbatra/format-adapters": minor
---

Add the first slice of format-adapters: the FormatAdapter interface, an open-for-extension
adapter registry with defined no-match and ambiguous resolution, and the i18next JSON adapter
(nested/namespaced keys, CLDR plural-suffix detection, {{double-brace}} placeholder extraction,
order-preserving round-trip, structured errors on malformed input, prototype-pollution-safe
parsing). ICU-validity is produced in core's expected shape (empty for i18next).
