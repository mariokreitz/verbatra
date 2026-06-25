---
"@verbatra/format-adapters": patch
---

fix(format-adapters): guard i18next $t() nesting references in placeholder integrity

The i18next extractor only matched `{{double-brace}}` interpolation, so nesting references (`$t(common.foo)`, `$t(common.foo, { options })`) were invisible to the integrity check. A translation that dropped, altered, or translated a `$t(...)` reference changed which message was composed at runtime yet passed integrity.

The i18next extractor now also extracts `$t(...)` references and guards them as placeholders (multiset-aware, verbatim). The double-brace primitive is split into its own `extractDoubleBracePlaceholders`, which ngx-translate now uses, since ngx-translate has the same interpolation syntax but no `$t()` nesting (it no longer mis-extracts `$t(...)` as a placeholder). Nested parentheses inside `$t()` options are not supported and only the default `$t(` prefix is recognized; extraction remains linear-time. Closes the H3 finding from the full-stack audit (#19, #22).
