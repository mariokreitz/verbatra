# @verbatra/cli

## 0.5.0-next.3

### Minor Changes

- b6c871f: Harden the CLI's error handling at four boundary points that previously bypassed the structured error
  scaffold and could surface a raw stack instead of a clean exit code:

  - `translate` and `watch` now load `.env`/`.env.local` inside the same try that maps errors to exit
    `2`. A missing `.env` file is still a silent no-op, but a non-ENOENT read error (for example an
    unreadable file, or a directory named `.env`) now renders as a structured error instead of an
    unhandled exception.
  - `--debounce` is now validated instead of silently defaulted. A non-integer, zero, negative, or
    unit-suffixed value (like `250ms`) is rejected as a usage error (`INVALID_DEBOUNCE`, exit `2`); it no
    longer falls back to the 300ms default. This is a user-facing behavior change: a `--debounce` value
    that previously silently defaulted now fails the run.
  - All six one-shot commands (`translate`, `watch`, `export`, `import`, `check`, `diff`) now validate
    their options with a zod schema inside the error scaffold. `import`'s option parsing in particular
    moved inside the try, so a malformed option object can no longer escape as an unhandled rejection.
  - The exit-code documentation in the package header and `run()`'s JSDoc now also names `check`/`diff`
    returning `1` for drift or pending changes, alongside `translate`/`import`'s "some locales failed".

  `@verbatra/sdk` is version-locked with `@verbatra/cli` and picks up the same bump with no behavior
  change of its own.

### Patch Changes

- Updated dependencies [35fe0f6]
- Updated dependencies [874cf70]
- Updated dependencies [e617c6b]
- Updated dependencies [dfd2b77]
  - @verbatra/sdk@0.5.0-next.3

## 0.5.0-next.2

### Patch Changes

- Updated dependencies [565eb89]
- Updated dependencies [4c6fd52]
- Updated dependencies [2127234]
- Updated dependencies [f3fd15f]
  - @verbatra/sdk@0.5.0-next.2

## 0.5.0-next.1

### Patch Changes

- Updated dependencies [14e9719]
- Updated dependencies [440212e]
- Updated dependencies [54a641a]
- Updated dependencies [400e044]
- Updated dependencies [2fe16b2]
- Updated dependencies [b945e53]
  - @verbatra/sdk@0.5.0-next.1

## 0.5.0-next.0

### Minor Changes

- a923c09: Add a `verbatra studio` command that starts Verbatra Studio, a local, read-only translation dashboard served from `@verbatra/studio`. The command loads the project config before anything else, prints a one-time tokenized loopback URL once the server is listening, and exits cleanly on Ctrl-C (a second interrupt force-stops it). It reaches `@verbatra/studio` only through a dynamic import, so it fails with a clear install hint instead of a crash when that package is not present. `@verbatra/sdk` is version-locked with `@verbatra/cli` and picks up the same bump; its own behavior is unchanged.

### Patch Changes

- Updated dependencies [5597f98]
- Updated dependencies [4a789ff]
  - @verbatra/sdk@0.5.0-next.0

## 0.4.4

### Patch Changes

- Updated dependencies [8591e82]
- Updated dependencies [43e3dbe]
- Updated dependencies [714324f]
- Updated dependencies [f3f47ad]
- Updated dependencies [e8a1e1d]
- Updated dependencies [75f54cb]
- Updated dependencies [d119616]
  - @verbatra/sdk@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [0470883]
- Updated dependencies [55fc543]
- Updated dependencies [3b6d79f]
- Updated dependencies [c525929]
  - @verbatra/sdk@0.4.3

## 0.4.2

### Patch Changes

- 2ac8ad6: Remediate open npm audit advisories with pnpm overrides. Lifts the transitive uuid copy bundled through exceljs to >=11.1.1 (GHSA-w5hq-g745-h8pq) on the published path, and the dev-only js-yaml (GHSA-h67p-54hq-rp68, to the patched v3 line) and esbuild (GHSA-g7r4-m6w7-qqqr) copies. No source or public API change; this records the change to the resolved dependency tree of the published packages.
- Updated dependencies [2ac8ad6]
  - @verbatra/sdk@0.4.2

## 0.4.1

### Patch Changes

- 792c889: Fix `defineConfig` and config authoring failing to typecheck in consumer projects. The published `.d.ts` files imported unpublished `@verbatra/*` internals that do not exist in a consumer install, so the provider model types degraded to `never` and every `defineConfig` call failed with TS2769. The SDK declaration build now inlines those private workspace types, so the published declarations no longer reference `@verbatra/core`, `@verbatra/ai-providers`, or `@verbatra/format-adapters`. `defineConfig` now typechecks for every provider id with per-provider model autocomplete preserved.
- Updated dependencies [792c889]
  - @verbatra/sdk@0.4.1

## 0.4.0

### Minor Changes

- 6dc983c: Add a read-only `check` command and the matching SDK `check()` surface. `verbatra check` reports, per target locale, how many keys are missing (present in the source, absent from the target), how many are stale (the source changed since the target was last translated), and how many are up to date. It calls no provider, needs no API key, writes no files, and never touches the lock.

  Exit codes make it CI-friendly: `0` when every locale is in sync, `1` when at least one locale has a missing or stale key (the full per-locale report is still printed), and `2` when the run could not start (a structured error to stderr, with stdout left clean for `--json` piping). Flags mirror the other commands: `--cwd`, `--config`, `--locales`, and `--json` (the JSON form is the SDK `CheckSummary` verbatim).

  The SDK exposes `check(input, deps?)` returning a `CheckSummary` of `{ inSync, locales }`, where each `LocaleCheckSummary` carries `{ locale, missing, stale, upToDate, inSync }`. It reuses the existing source read, adapter selection, lock baseline, and core `diffResources`, so there is one definition of drift in the codebase.

- 986d832: Add a read-only `diff` command and the matching SDK `diff()` surface, the detailed sibling of `check`. Where `check` reports per-locale counts, `verbatra diff` reports the actual keys: per target locale it lists the keys that would be added (missing from the target), the keys that would be re-translated (the source changed since the target was last translated), and the keys that are orphaned (present in the target, absent from the source). It calls no provider, needs no API key, writes no files, and never touches the lock.

  Exit codes make it CI-friendly: `0` when no locale has pending changes, `1` when at least one locale has a missing or changed key (the full per-locale report is still printed first), and `2` when the run could not start (a structured error to stderr, with stdout left clean for `--json` piping). Orphaned keys are always reported but never on their own flip the exit code, because a default `translate` run does not prune. Flags mirror the other commands: `--cwd`, `--config`, `--locales`, and `--json` (the JSON form is the SDK `DiffSummary` verbatim, with the full key lists).

  The SDK exposes `diff(input, deps?)` returning a `DiffSummary` of `{ hasPendingChanges, locales }`, where each `LocaleDiff` carries `{ locale, missing, changed, orphaned, hasPendingChanges }`. Internally, `check` and `diff` now share a single read-plus-diff orchestration over the existing source read, adapter selection, lock baseline, and core `diffResources`, so there is one definition of drift in the codebase. The `check` public contract is unchanged.

- b0a558f: Add three new format adapters: XLIFF, YAML, and Flutter ARB. verbatra can now point at XLIFF (`.xlf`, `.xliff`), YAML (`.yml`, `.yaml`), and ARB (`.arb`) locale files in the same translate and watch flows, with no change to how the tool is run. Select a new format through the existing config `format` key; the SDK and CLI pick the adapters up through the registry automatically.

  - XLIFF: parses XLIFF 1.2 (file/body/trans-unit) and 2.0 (file/unit/segment), reading the target over the source. Writes update the target in place, leaving the source, every attribute, and every note untouched so they round-trip. A missing destination is rejected with a structured error, because source, target, and attributes cannot be synthesized from a flat key/value map (standard tooling seeds the target file first).
  - YAML: a nested tree like JSON in YAML syntax, with i18next-compatible `{{double-brace}}` interpolation. Anchor-alias expansion is bounded against billion-laughs input, and non-object roots and non-string leaves are rejected.
  - ARB: JSON-based Flutter resource bundles. `@`-prefixed metadata keys are preserved and round-tripped in document order, never sent for translation. Message values are ICU MessageFormat, so placeholders, plurals, and message validity reuse the shared ICU analysis.

  Internally, the JSON adapter factory is generalized into a shared tree-file factory (hosting the JSON family, ARB, and YAML) plus a small flat-file factory (XLIFF), both reusing the same bounded read, structured errors, and atomic write. The four existing JSON adapters are unchanged. Two runtime dependencies are added to `@verbatra/sdk`: `yaml` and `@xmldom/xmldom`, both with permissive licenses and no native bindings.

### Patch Changes

- 86d7fcb: Centralize the CLI `init` lookup tables behind an SDK scaffolding-metadata surface and consolidate the one-shot whole-run error scaffold. This is a behavior-preserving refactor: the scaffolded `verbatra.config.ts`, `.env.example`, and `.gitignore` bytes are identical, and every command exit code (`0`, `1`, `2`, `130`) is unchanged.

  `@verbatra/sdk` gains one additive, read-only export, `scaffoldingMetadata` (provider id to env var, LLM provider id to a cosmetic default scaffold model, and the supported format ids), plus a re-exported `SupportedFormat` type. The values are sourced from `@verbatra/core` (format ids) and `@verbatra/ai-providers` (provider env vars and scaffold models); the SDK assembles a pass-through and owns no copy. A `Record<ProviderId, string>` compile guard ties the env-var table to the canonical provider union.

  The CLI `init` command now reads provider ids, env-var names, and default models from `scaffoldingMetadata` instead of hand-maintained local tables, so a provider, env-var, model, or format-id change in a lower package breaks the CLI build instead of silently drifting. The `FORMAT_BY_DEP` npm-dependency-to-format detection map stays CLI-local by design, with its format ids typed against `SupportedFormat`. The repeated load-config plus try/catch plus `return 2` scaffold in `runTranslate`, `runExport`, `runImport`, `runCheck`, and `runDiff` is consolidated into one `withWholeRunErrors` helper; `runWatch` keeps its own streaming error model and the `130` force-stop path.

  The new SDK export is internal-facing and the change is behavior-preserving, so this is a patch on the version-locked `sdk` and `cli` pair. The private `core` and `ai-providers` packages ship no changeset.

- Updated dependencies [6dc983c]
- Updated dependencies [986d832]
- Updated dependencies [b0a558f]
- Updated dependencies [86d7fcb]
  - @verbatra/sdk@0.4.0

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
  or watch(), and renders the returned structured result - adding no translation, diff, or lock logic
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
