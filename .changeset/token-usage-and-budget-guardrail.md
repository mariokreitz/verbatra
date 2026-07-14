---
"@verbatra/sdk": minor
---

`translate`, `watch`, and `importWorkbook` now aggregate the token usage every LLM provider already
reports per call. `LocaleSummary.usage` and `RunSummary.usage` sum input and output tokens across
every provider call in scope (main translation and plural generation alike); both stay `undefined`,
never a fabricated zero, whenever nothing in that scope reported usage (a dry-run, or a token-less
provider such as DeepL).

A new optional config pair, `maxTokens` and `budgetBehavior` (`"warn"` or `"stop"`, default `"warn"`),
lets a project cap or flag a run's spend. The check runs after each completed provider sub-batch, never
mid-batch: the sub-batch whose completion crosses the ceiling is retained and counted, since a call
already in flight cannot be undone. Under `"warn"` the run continues unchanged past the ceiling. Under
`"stop"`, every not-yet-attempted key for the rest of the run, in the current locale and every later
target locale, is withheld into a new `LocaleSummary.budgetWithheld` array (parallel to
`integrityMismatches` and `providerFailures`) and retried automatically next run, exactly like a failed
provider call today. A budget trip never fails a locale and never changes the exit code of `translate`,
`watch`, or `import`. `RunSummary.budget` is present only when `maxTokens` is configured, including a
`supported: false` case against a token-less provider or a dry-run, so the guardrail is visibly and
honestly inert rather than silently omitted or falsely tripped.

The CLI's human `translate`/`watch` summary now shows per-locale and aggregate token counts when usage
was reported, and a budget line when a ceiling is configured. `--json` output needed no new rendering
code: the new fields serialize automatically once populated.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump for the new rendering.
