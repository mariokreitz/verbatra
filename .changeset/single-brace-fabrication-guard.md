---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Reject a fabricated single-brace placeholder under the double-brace formats.

For `i18next-json`, `ngx-translate-json`, and `yaml`, a `{name}`-shaped token is literal
text rather than interpolation, so it was never extracted as a placeholder and the
integrity gate could not see it. A translation could therefore alter `{name}` to `{nome}`,
keep `{orderId}` while inventing `{evilInjected}`, or inject `{stolenSecret}` into a
placeholder-free source, and every one of those was accepted and written on all three write
paths (provider translation, workbook import, and a Studio edit). Once written, the value
locked against the source hash, so `check` and `diff` then reported the locale up to date.

These adapters now supply a placeholder comparator that adds a one-directional check on top
of their existing double-brace comparison: a `{name}`-shaped token present in the candidate
and absent from the source is reported as `extra`, which the gate refuses with the existing
`placeholder` reason. No new gate reason and no new config key. The check is deliberately
one-directional, because dropping such a token is undecidable without knowing the project's
interpolation delimiters, which verbatra has no setting for.

This is behavioural, not additive: a run that is green today can newly report integrity
mismatches, and those candidates are withheld rather than written. That includes results
from DeepL, whose entry partitioning is unchanged but whose output now goes through the same
comparator. A key it withholds was already carrying a placeholder its source never had.
