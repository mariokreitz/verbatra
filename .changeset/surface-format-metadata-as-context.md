---
"@verbatra/sdk": minor
---

Developer context that Flutter ARB (`@key.description`) and XLIFF (`<note>`) already carry now
reaches both the translation provider and the exported workbook, instead of always being blank.

ARB reads populate `entry.description` from `@key.description` via a new post-flatten hook on the
tree-file adapter, aligned by key with dotted literal keys. XLIFF reads populate `entry.description`
from a trans-unit's `<note>` (or, in XLIFF 2.0, the unit's `<notes><note>`, shared by every segment in
that unit). Neither format's write or round-trip behavior changes: the metadata is read-only context,
never written back.

`entry.description` already reached the AI provider payload as disambiguation context and was never
translated or echoed; this change only makes sure the field is finally populated for these two
formats. The exported workbook (`exportWorkbook`) gains a 7th column, `Context`, appended after
`Source hash` so the editable `Translation` column keeps its position. It is read-only and protected
like `Source` and `Current translation`. `importWorkbook` never reads `Context` as a translation
source, and a workbook built before this column existed still imports successfully.

One behavior change worth calling out: an ARB or XLIFF entry that carries a description or note will
re-export and re-translate once on upgrade, since the lock baseline's content hash already accounts
for `description` and now sees a value where it previously saw none. This is intentional: the newly
surfaced context can change how the string should be translated, so it gets one reconsideration pass,
and the baseline then stabilizes.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is
unchanged.
