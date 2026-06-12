---
"@verbatra/format-adapters": minor
---

Add the vue-i18n JSON adapter (createVueI18nJsonAdapter), registered in the default registry.
It handles single-brace {name}/{0} interpolation, recognizes pipe-separated plural values
("a | b | {count} c") setting isPlural while keeping the value verbatim, and preserves linked
messages (@:key) without extracting them. Shared JSON read/write helpers (parse + depth/size
guards, flatten, unflatten) were factored into an internal json/ module reused by both the
i18next and vue-i18n adapters; no public API or behavior change to i18next.
