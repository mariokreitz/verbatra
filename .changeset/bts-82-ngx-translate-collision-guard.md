---
"@verbatra/sdk": patch
---

Fix the ngx-translate path-notation flatten silently dropping or restructuring translations on a
key collision. A dotted flat key (`"a.b": "value"`) and a nested path (`"a": { "b": "value" }`)
that resolved to the same final path used to silently overwrite each other during a read, losing
one of the two values with no error; the flatten step now throws a structured `INVALID_STRUCTURE`
error instead. Separately, a nested object key that itself contains a literal dot (for example
`"a.b": { "c": "value" }`) used to write back restructured or merged with an unrelated key, since
the dot inside the object key was indistinguishable from a path separator; such a file is now
rejected as `MIXED_STRUCTURE` before any flattening happens. The literal-leaf adapters (i18next,
vue-i18n, next-intl) already rejected the equivalent collision; ngx-translate now has the same
guarantee. The change lives in the private `@verbatra/format-adapters` package, so the observable
behavior surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked).
