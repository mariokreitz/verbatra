---
"@verbatra/sdk": patch
---

Reject an empty translation of a non-empty source in the integrity gate.

`gateCandidateValue` accepted `""` as a valid translation whenever the source
carried no placeholders: the placeholder check compared `[]` against `[]`,
`validateMessage("")` is true on every adapter including the ICU ones, and the
degeneracy assessment finds no runaway repetition in a zero-length value.
Whitespace-only values were accepted the same way. On the two adapters that
define `comparePlaceholders` (next-intl and ARB), even a source carrying a
placeholder accepted an empty translation, because that branch re-derives from
the source value.

The consequences were silent and reported as a clean success. A provider
returning `""` had the empty value written, counted as translated, and stored in
the translation-memory cache; on a changed key it destroyed an existing good
translation. Because the cache is keyed by source content, the empty value was
then served to every other key whose source text was byte-identical, with no
provider call to notice it and nothing in `check` or `diff` to surface it.

An empty or whitespace-only candidate for a non-empty source is now withheld
with the new `empty` reason, on every write path: the provider path, content
fan-out, plural generation, workbook import, `editEntry` and
`retranslateEntry`. The check runs last, so no existing rejection reason
changes; only the wrongful accepts do. An empty source still round-trips an
empty translation.

Separately, a `[[CLEAR]]`ed workbook row no longer contributes to the cache.
`[[CLEAR]]` states an intent about one key, and the cache is content-addressed,
so storing it would hand the clear to unrelated keys sharing that source text.
Clearing a key still works exactly as before and is still the only supported way
to unset a translation.

This adds `empty` to the exported `IntegrityGateReason` union on
`@verbatra/sdk`. The behavior fixed is a defect, so the bump stays patch, but
the addition to the public type is called out here as deliberate, following the
policy recorded for `BLANK_ROW_BASELINE_RETAINED` in 0.4.4. Note that unlike
that case, this union is consumed in an exhaustive `Record` in
`@verbatra/studio`, so a consumer doing the same will need a new arm.
