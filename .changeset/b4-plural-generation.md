---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

feat(sdk): warn on missing CLDR plural categories, with opt-in generation (`generatePlurals`)

When a target language requires more CLDR plural categories than the i18next source supplies (for
example Arabic, Polish, or Russian against an English one/other source), verbatra emits a per-locale
`PLURAL_CATEGORIES_INCOMPLETE` notice naming the locale and the missing categories; the run still
succeeds. Opt-in `generatePlurals` makes verbatra synthesize the missing target forms so the written
plural set is complete, instead of only warning. This is off by default: enable it with a
`generatePlurals: true` config option or a per-run `generatePlurals` override (the override takes
precedence), mirroring the `prune` pattern.

Generation is supported for i18next-JSON projects translated by an LLM provider only. DeepL,
non-i18next formats, and target languages not in the static category lookup fall back to the existing
`PLURAL_CATEGORIES_INCOMPLETE` warning and never hard-fail. Generated forms ride the existing provider
path: the source plural value travels in the data channel and the CLDR category travels as data context
(meaning), so the prompt-injection boundary is unchanged and no provider request shape or schema changes.
Each generated form is placeholder/ICU integrity-checked like any translation; a failing form is withheld
(surfaced in `integrityMismatches`) and keeps the warning. Generated keys are tracked in the lock by a
hash of their governing source plural forms (not regenerated while those are unchanged, reconsidered when
they change, retried when withheld) and are surfaced on the run summary as a new `generated` field,
distinct from `translated`. The warning is suppressed only when a supported case produced a complete,
integrity-passing set.

The CLI surfaces this on its default human output: the per-locale line now shows a `generated` count
(only when non-zero, matching how `orphaned` and `pruned` are shown), so a user not using `--json` sees
when plural forms were synthesized. The JSON and NDJSON output already carried the `generated` field
verbatim.
