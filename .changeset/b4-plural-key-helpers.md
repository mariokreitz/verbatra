---
"@verbatra/format-adapters": minor
---

feat(format-adapters): expose i18next plural key derivation helpers

Add `pluralCategoryOf`, `pluralBaseKey`, and `makePluralKey` (and the `I18nextPluralCategory` type)
alongside the existing `isPluralKey`. These keep the i18next CLDR plural-suffix grammar owned by the
format adapter so the SDK can derive a target plural key (for example `items` + `few` -> `items_few`) and
read the category off a key without encoding the suffix shape itself. Used by the SDK's opt-in
plural-category generation.
