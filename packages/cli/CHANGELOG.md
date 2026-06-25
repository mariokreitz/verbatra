# @verbatra/cli

## 0.3.0

### Minor Changes

- 4fd6165: feat(sdk): warn on missing CLDR plural categories, with opt-in generation (`generatePlurals`)

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

- 4fd6165: feat: add opt-in orphan pruning (`--prune`)

  Pruning is off by default and never deletes translator work silently. Enable it with the new
  `translate --prune` flag or a `prune: true` option in the config (the flag takes precedence per run).
  When on, verbatra removes exactly the orphaned keys (present in a target file but absent from the
  source) from the written target file and the lock; no other key is ever touched. Combine
  `--prune --dry-run` to preview which keys would be removed without writing anything. The run summary
  (human and `--json` / watch NDJSON) reports a per-locale pruned count and key list alongside the
  existing orphaned reporting.

### Patch Changes

- e1117b6: fix(init): scaffold a real default model per provider

  `verbatra init` now writes a real default model (anthropic `claude-sonnet-4-6`, openai
  `gpt-5.4-mini`, gemini `gemini-2.5-flash`) instead of the `<your-model>` placeholder, so a
  freshly scaffolded `verbatra.config.ts` type-checks immediately under the per-provider model
  restriction. Change it to any model the provider supports; the runtime accepts any non-empty
  string, so the default going stale is cosmetic.

- 4fd6165: fix(cli): handle a rejected watcher stop so a failed shutdown exits cleanly

  Both watch-session stop seams now catch a rejection from the underlying stop: the error is rendered to stderr and the session resolves exit code 2 instead of leaking an unhandled rejection that could crash the process. A clean stop still resolves 0 and a forced second stop still resolves 130.

- Updated dependencies [4fd6165]
- Updated dependencies [4fd6165]
- Updated dependencies [2ba217b]
- Updated dependencies [4fd6165]
- Updated dependencies [4fd937b]
  - @verbatra/sdk@0.3.0

## 0.2.2

### Patch Changes

- Updated dependencies [82c4555]
  - @verbatra/sdk@0.2.2

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
