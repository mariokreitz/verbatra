# @verbatra/cli

## 0.2.1

### Patch Changes

- 3d38db5: Bring the published package READMEs up to the shipped 0.2.0 surface. The CLI README now lists all
  five commands (adds `export` and `import`) with their documentation links and a note on the manual
  -translation workflow. The SDK README documents all six exported functions (adds `exportWorkbook`
  and `importWorkbook` with signatures) and the optional `glossary` and `tone` config fields. The
  npm `homepage` now points at the documentation site. No runtime code changed.
- Updated dependencies [3d38db5]
  - @verbatra/sdk@0.2.1

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

### Patch Changes

- Updated dependencies [fc83588]
  - @verbatra/sdk@0.2.0

## 0.1.0

### Minor Changes

- fef4a2e: Add @verbatra/cli, the v1 command-line interface and a thin wrapper over @verbatra/sdk. It exposes a
  `verbatra` binary with two subcommands: `translate` (one-shot) and `watch` (long-running). The CLI
  parses arguments with commander, loads config via the SDK's loadConfig, calls the SDK's translate()
  or watch(), and renders the returned structured result — adding no translation, diff, or lock logic
  of its own. Shared `--cwd` and `--config` (a pass-through to loadConfig's configPath); `translate`
  adds `--dry-run` and `--json`; `watch` adds `--debounce` and `--json` (NDJSON, one record per run).
  Human output by default, with strict stdout/stderr discipline so `--json` stdout is a clean,
  parseable stream. Exit codes: 0 success, 1 a per-locale failure, 2 a whole-run/startup/usage error,
  130 a forced second Ctrl-C during watch. SIGINT triggers a graceful stop that awaits the in-flight
  run. The only new dependency is commander (pinned exact).

### Patch Changes

- Updated dependencies [c5d8cd6]
- Updated dependencies [8861ed8]
- Updated dependencies [1390e2d]
  - @verbatra/sdk@0.1.0
