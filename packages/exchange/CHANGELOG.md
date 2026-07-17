# @verbatra/exchange

## 0.3.0

### Minor Changes

- e617c6b: Fix `exportWorkbook`'s `includeUnchanged` option labeling already up-to-date rows as `"changed"`.
  `RowStatus` gains a third value, `"unchanged"`, and rows from the unchanged diff bucket are now
  exported with that status instead of the misleading `"changed"`, which told translators the source
  string had changed and needed re-translation even though it had not. The read-side row schema
  accepts `"unchanged"` so a previously exported sheet round-trips through import without error, and
  the instructions sheet gains an honest line explaining the new status. Import behavior is
  unaffected: it already decides accept-or-withhold purely from source-hash drift, placeholder, and
  ICU checks, never from the status column.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
  is unchanged.

- dfd2b77: Developer context that Flutter ARB (`@key.description`) and XLIFF (`<note>`) already carry now
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

## 0.3.0-next.0

### Minor Changes

- e617c6b: Fix `exportWorkbook`'s `includeUnchanged` option labeling already up-to-date rows as `"changed"`.
  `RowStatus` gains a third value, `"unchanged"`, and rows from the unchanged diff bucket are now
  exported with that status instead of the misleading `"changed"`, which told translators the source
  string had changed and needed re-translation even though it had not. The read-side row schema
  accepts `"unchanged"` so a previously exported sheet round-trips through import without error, and
  the instructions sheet gains an honest line explaining the new status. Import behavior is
  unaffected: it already decides accept-or-withhold purely from source-hash drift, placeholder, and
  ICU checks, never from the status column.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
  is unchanged.

- dfd2b77: Developer context that Flutter ARB (`@key.description`) and XLIFF (`<note>`) already carry now
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

## 0.2.1

### Patch Changes

- Updated dependencies [c2871a9]
- Updated dependencies [4fd6165]
  - @verbatra/core@0.1.1

## 0.2.0

### Minor Changes

- fc83588: Add the Excel manual-translation workflow: export untranslated strings to a styled `.xlsx`
  workbook and import the filled workbook back into the locale files.

  - New package `@verbatra/exchange`: a neutral, format-agnostic workbook row model with
    `buildWorkbook` and `readWorkbook`. The xlsx library (exceljs) is isolated here. The
    untrusted workbook parse is bounded (entry, decompressed-byte, sheet, row, and cell caps)
    and its XML is rejected if it declares a DTD or entity; structural problems surface as a
    structured, secret-free `WORKBOOK_INVALID` error.

    Threat model and design reasoning for the workbook parse guards:

    - The decompressed-byte cap is checked both against each entry's declared (header) size and
      against the bytes actually produced as the entry decompresses, so a zip whose header lies
      about the uncompressed size cannot bypass the cap (a decompression-bomb / "zip bomb"
      defense).
    - The DTD/entity rejection (`assertNoDoctype`) is a deliberately parser-independent,
      defense-in-depth guard against XXE and entity-expansion. exceljs parses XML with saxes,
      which by analysis does not resolve external entities by default; rather than depend on that
      default holding across library versions, the guard rejects any part that even declares a
      DTD or entity before exceljs ever parses it. It runs on every decompressed entry, not only
      `.xml`/`.rels`, because exceljs also parses markup parts such as `.vml`, so a DOCTYPE or
      ENTITY smuggled into one of those must be caught before parsing. A well-formed xlsx contains
      neither construct in any part.
    - These caps and the DTD/entity guard were added during the security review of the workbook
      interchange feature.

  - `@verbatra/sdk`: `exportWorkbook` and `importWorkbook`, composing the existing source read,
    adapter selection, lock baseline, diff, and the core placeholder/ICU/drift checks. Import
    returns a `RunSummary` structurally identical to `translate`'s; withheld rows (placeholder
    mismatch, invalid ICU, source drift) are reported and never written, and the lock is not
    updated for them.
  - `@verbatra/cli`: `verbatra export` and `verbatra import <workbook>`, thin wrappers over the
    SDK with `--include-unchanged` on export and `--dry-run` on import. The import exit-code rule
    matches `translate`.
  - `@verbatra/format-adapters`: one additive, non-breaking `FormatAdapter.validateMessage(value)`
    method to ICU-check a filled value before writing (next-intl delegates to its existing ICU
    logic; the other adapters report every value valid).
