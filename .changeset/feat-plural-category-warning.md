---
"@verbatra/sdk": minor
---

feat(sdk): warn per locale when a target language needs more CLDR plural categories than the source supplies

When the target language requires more CLDR plural categories than the i18next source provides (for example Arabic, Polish, or Russian against an English one/other source), the run now emits a per-locale notice naming the locale and the missing categories. The run still succeeds; verbatra warns only and does not synthesize the missing forms.
