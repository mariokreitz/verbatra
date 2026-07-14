---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add a derived, per-key "needs review" signal for translations, distinct from the
placeholder/ICU integrity gate: a suspiciously short or long output, a translation
identical to the source, a missed glossary term, a placeholder set that matches but
landed in a different order, or a batch that was gracefully degraded by the provider
(currently DeepL only) now surfaces as a review flag instead of passing silently.

`translate` and `watch` summaries gain a `needsReview` list of flagged keys and their
reason codes, and `verbatra translate`/`watch`'s human output shows a `needs-review`
count alongside `integrity-withheld` and `notices` when it is non-zero (already
present in `--json` once the summary carries the field). The Excel export/import
workbook gains two read-only "Review status" / "Review reasons" columns, recomputed
fresh from the on-disk source and current target at export time; they are purely
informational and never gate what import accepts, and importing a workbook exported
before this change (with no such columns) is unaffected.

This is advisory only: a review flag never withholds a translation, and there is no
way to "clear" it other than fixing the underlying value. A workbook exported later
from the same on-disk target does not retroactively show a `PROVIDER_DEGRADED` flag
from an earlier run, since that fact lives only in memory during the run that
produced it.
