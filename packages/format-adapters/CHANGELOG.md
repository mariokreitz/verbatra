# @verbatra/format-adapters

## 0.3.0

### Minor Changes

- 4fd6165: feat(format-adapters): round-trip literal dotted leaf keys losslessly

  A JSON locale key that contains a literal dot used as a single leaf (for example
  `{"foo.bar": "Hi"}`) is now read, translated, and written back as one literal leaf instead of
  being silently re-nested into `{"foo": {"bar": "Hi"}}`. Real nested paths still stay nested, and a
  file mixing both round-trips with each member's shape preserved. The fix lives once in the shared
  JSON layer (a per-segment backslash escape in `flatten`/`unflatten`), so all four JSON adapters
  benefit; ngx-translate keeps its flat-vs-nested path-notation behavior unchanged.

  A genuinely ambiguous file (a literal dotted leaf and a real nested path resolving to the same
  effective path, for example `{"foo.bar": "Hi", "foo": {"bar": "Hello"}}`) still fails loudly with a
  structured `AdapterError` (`INVALID_STRUCTURE`); it is never silently picked or corrupted.

  Compatibility: the change is observable only for keys that actually contain a literal dot. Projects
  with no literal dotted leaf keys are unaffected: write output is byte-for-byte identical, lock-file
  keys and content hashes are unchanged, and a re-run performs no re-translation. There is no
  lock-file version bump. Projects that already used literal dotted leaf keys may see a one-time
  re-translation limited to those dotted keys (their on-disk shape was previously rewritten as
  nested); non-dotted keys in the same project are unaffected.

- 4fd6165: feat(format-adapters): expose i18next plural key derivation helpers

  Add `pluralCategoryOf`, `pluralBaseKey`, and `makePluralKey` (and the `I18nextPluralCategory` type)
  alongside the existing `isPluralKey`. These keep the i18next CLDR plural-suffix grammar owned by the
  format adapter so the SDK can derive a target plural key (for example `items` + `few` -> `items_few`) and
  read the category off a key without encoding the suffix shape itself. Used by the SDK's opt-in
  plural-category generation.

### Patch Changes

- d40b7f1: fix(format-adapters): guard i18next $t() nesting references in placeholder integrity

  The i18next extractor only matched `{{double-brace}}` interpolation, so nesting references (`$t(common.foo)`, `$t(common.foo, { options })`) were invisible to the integrity check. A translation that dropped, altered, or translated a `$t(...)` reference changed which message was composed at runtime yet passed integrity.

  The i18next extractor now also extracts `$t(...)` references and guards them as placeholders (multiset-aware, verbatim). The double-brace primitive is split into its own `extractDoubleBracePlaceholders`, which ngx-translate now uses, since ngx-translate has the same interpolation syntax but no `$t()` nesting (it no longer mis-extracts `$t(...)` as a placeholder). Nested parentheses inside `$t()` options are not supported and only the default `$t(` prefix is recognized; extraction remains linear-time. Closes the H3 finding from the full-stack audit (#19, #22).

- 8775839: fix(format-adapters): preserve placeholder multiplicity so dropped or duplicated placeholders are caught

  The i18next, vue-i18n, ngx-translate, and next-intl extractors previously deduplicated placeholders with a `Set` before returning them. That collapsed `{{count}} of {{count}}` to a single occurrence and silently defeated core's multiset integrity check: a translation that dropped one required occurrence (for example `{{count}} total`) passed integrity and was written.

  Extractors now return every occurrence in document order. Combined with `checkPlaceholders` (already multiset-aware), a dropped or duplicated placeholder is now reported as `missing`/`extra`. ICU message bodies are preserved verbatim by translation, so an occurrence missing from one plural/select branch is likewise reported as a mismatch. Closes the C1 finding from the full-stack audit (#19, #20).

- 4fd6165: fix: make atomic-write temp-file names collision-proof

  Both atomic-write paths (the SDK file seam and the format-adapters JSON writer) now append a random UUID to the temp-file name, so two writes to the same target in the same millisecond from the same process can never collide on the temp name. The atomic same-directory-temp-then-rename behavior is otherwise unchanged.

- eb59150: fix(format-adapters): tighten vue-i18n placeholder extraction to the real interpolation grammar

  The vue-i18n extractor matched any single-brace run (`/\{[^{}]*\}/`), which over-captured: `"Hello {{name}}"` yielded a phantom `{name}`, literal text like `"{curly braces}"` was treated as a placeholder, and `{ name }` did not compare equal to `{name}`.

  Extraction now follows vue-i18n's actual grammar: named keys (`{name}`, letters/underscore then letters, digits, underscores, hyphens, dollar signs) and list keys (`{0}`), with inner whitespace normalized to a canonical `{key}` token. Double-brace text (`{{...}}`) and literal interpolation (`{'...'}`) are correctly excluded. Extraction remains linear-time on adversarial input. Closes the H2 finding from the full-stack audit (#19, #21).

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

## 0.1.0

### Minor Changes

- b346b68: Add the first slice of format-adapters: the FormatAdapter interface, an open-for-extension
  adapter registry with defined no-match and ambiguous resolution, and the i18next JSON adapter
  (nested/namespaced keys, CLDR plural-suffix detection, {{double-brace}} placeholder extraction,
  order-preserving round-trip, structured errors on malformed input, prototype-pollution-safe
  parsing). ICU-validity is produced in core's expected shape (empty for i18next).
- 61e217e: Add the next-intl JSON adapter (createNextIntlJsonAdapter), registered in the default registry.
  It parses ICU MessageFormat values to extract argument and rich-text tag placeholders without
  resolving them, sets isPlural from a plural/selectordinal argument, and reports values that fail
  to parse via invalidIcuKeys; the ICU body is kept verbatim on round-trip. ICU parsing uses
  @formatjs/icu-messageformat-parser (the canonical FormatJS parser next-intl builds on) and is
  bounded — a value too deep or malformed is reported as invalid, never thrown. Internally, the
  shared adapter shell was extracted into createJsonFileAdapter and the i18next and vue-i18n
  adapters were reimplemented on it (no behavior change).
- bde1174: Add the ngx-translate JSON adapter (createNgxTranslateJsonAdapter), registered in the default
  registry. It handles both flat ("app.hello": "...") and nested file structures and preserves the
  original style on write (flat stays flat, nested stays nested; a new path defaults to nested),
  rejecting files that mix the two with a structured MIXED_STRUCTURE error. Interpolation is
  {{double-brace}} (reusing the i18next extractor); ngx-translate has no built-in plural or ICU, so
  values are plain strings, isPlural is always false, and invalidIcuKeys is empty. The shared
  createJsonFileAdapter factory gained two optional hooks (validateTree, buildWriteTree); the
  existing adapters are unchanged.
- b346b68: Add the vue-i18n JSON adapter (createVueI18nJsonAdapter), registered in the default registry.
  It handles single-brace {name}/{0} interpolation, recognizes pipe-separated plural values
  ("a | b | {count} c") setting isPlural while keeping the value verbatim, and preserves linked
  messages (@:key) without extracting them. Shared JSON read/write helpers (parse + depth/size
  guards, flatten, unflatten) were factored into an internal json/ module reused by both the
  i18next and vue-i18n adapters; no public API or behavior change to i18next.

### Patch Changes

- 2ab85ca: Make the target-file write atomic: the serialized content is written to a temp file in the same
  directory as the target and then renamed over it, so a crash or interruption mid-write can no
  longer leave a truncated/corrupt target file — a reader sees either the complete prior file or the
  complete new file. Behavior-preserving otherwise: the serialized bytes are byte-identical across
  all four adapters, a write failure still surfaces as the raw fs error (no new error type/code), and
  temp cleanup is best-effort and never masks the original error. Parity with the SDK's lock-file
  atomic write.
- b346b68: Harden the i18next read path against hostile files (Security NO-GO fixes): placeholder
  extraction is now linear (was quadratic on unbalanced `{{`), and read enforces a maximum
  nesting depth and input size, surfacing over-limit or otherwise failing input as a structured
  AdapterError (new codes MAX_DEPTH_EXCEEDED and INPUT_TOO_LARGE) instead of an uncaught
  RangeError. Error messages no longer echo file key paths. No public API signature changes;
  behavior is unchanged for well-formed files.
- b5cd960: Harden JSON and ngx-translate file reads against a stat-then-read TOCTOU by reading through a single fstat'd file handle with a bounded read, so swapping the path for a larger file cannot bypass the size cap. Also wrap ICU validity computation so every read failure surfaces as a structured `AdapterError`.
- Updated dependencies [bde1174]
- Updated dependencies [7aeaca7]
  - @verbatra/core@0.1.0
