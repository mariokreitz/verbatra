# @verbatra/sdk

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

- 4fd937b: feat(sdk): split a locale's translation request into bounded sub-batches

  A locale's missing-plus-changed entries are now divided into sequential sub-batches no larger than a
  configured maximum, and each sub-batch is sent as its own provider request. A locale whose entry
  count is at or below the maximum still issues exactly one request, so the common case is unchanged.
  The accepted translations from every sub-batch are merged into one target file and written once, so
  the on-disk result for a multi-sub-batch locale is identical to what a single un-chunked request
  would have produced for the same accepted set.

  The maximum is a new optional config field, `maxBatchSize`: a positive integer validated at the
  config boundary (zero, a negative number, a non-integer, or a non-number is rejected with a
  structured config error). When the field is absent the documented default of 50 applies. The field
  is config-only for this slice; no CLI flag is added.

  A failed sub-batch no longer sinks the locale. If a sub-batch's provider call throws, or its results
  fail integrity, only that sub-batch's keys are withheld (not locked, so they are retried next run)
  while the remaining sub-batches are still merged, written, and locked. The locale's overall status
  stays `succeeded`, and a chunk-level provider failure surfaces as a concise, secret-free
  `SUB_BATCH_FAILED` notice on the locale summary rather than throwing. The raw provider error is never
  bound or surfaced. This is a behavior change for the provider-throw path: a thrown provider call
  previously failed the whole locale, and now isolates to the affected sub-batch's keys.

  Compatibility: projects whose locales fit within the default in a single request behave exactly as
  before. Lock-file format and semantics are unchanged.

### Patch Changes

- 2ba217b: fix(config): restrict the provider model field to the selected provider's known models

  `defineConfig` is now declared as one overload per provider id, each taking that
  provider's concrete authoring config. Overload resolution picks the variant from the
  `provider.id` literal, so `provider.options.model` is restricted to that provider's known
  model IDs: the editor offers only those models, and a foreign or unknown model (for
  example a Claude model under `id: "gemini"`) is a type error at authoring time. Concrete
  per-provider signatures avoid the generic/nested-discriminated-union inference that some
  editors (notably the JetBrains/WebStorm completion engine) do not perform and that
  otherwise makes them fall back to offering every provider's models. This is a type-only
  DX change: the runtime schema stays `z.string().min(1)` (a model the installed provider
  SDK does not yet list is flagged in the editor but still runs), `defineConfig` still
  returns `VerbatraConfig`, and DeepL (no model field) is unchanged.

- 4fd6165: fix: make atomic-write temp-file names collision-proof

  Both atomic-write paths (the SDK file seam and the format-adapters JSON writer) now append a random UUID to the temp-file name, so two writes to the same target in the same millisecond from the same process can never collide on the temp name. The atomic same-directory-temp-then-rename behavior is otherwise unchanged.

## 0.2.2

### Patch Changes

- 82c4555: Add provider model autocompletion to config authoring, sourced from the installed
  provider SDK types. Each LLM provider now exports a model type (`AnthropicModel`,
  `OpenAiModel`, `GeminiModel`) taken directly from that provider SDK's own published
  model type, so the single source of truth is the installed SDK and there is no
  hand-maintained list to drift. `defineConfig` surfaces those IDs as editor completions
  for `provider.options.model`, narrowed by the selected `provider.id`. This is a
  type-only DX change: the suggestions are an open union that still accepts any other
  string, the runtime schema stays `z.string().min(1)`, and there is no runtime behavior
  change.

## 0.2.1

### Patch Changes

- 3d38db5: Bring the published package READMEs up to the shipped 0.2.0 surface. The CLI README now lists all
  five commands (adds `export` and `import`) with their documentation links and a note on the manual
  -translation workflow. The SDK README documents all six exported functions (adds `exportWorkbook`
  and `importWorkbook` with signatures) and the optional `glossary` and `tone` config fields. The
  npm `homepage` now points at the documentation site. No runtime code changed.

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

- c5d8cd6: Add an optional `configPath` to `loadConfig`'s options for loading one explicit config file instead
  of searching. When given, the loader resolves the path (relative against `cwd`, absolute as-is) and
  loads it through cosmiconfig's `load()`, which reuses the same loaders search uses (.json/.yaml/.ts via
  the TypeScript loader), then validates it through the same zod boundary. A genuinely missing file is
  `CONFIG_NOT_FOUND`; a present-but-unparseable or invalid file is `CONFIG_INVALID` - both existing
  codes, no new error code. Precedence is `configOverride` > `configPath` > search. Purely additive: when
  `configPath` is absent, `loadConfig` behaves exactly as before (the existing config-loading tests are
  unchanged). This unblocks the CLI's `--config <path>` flag as a thin pass-through.
- 8861ed8: Add @verbatra/sdk, the central orchestration API and the first SDK slice: the one-shot
  end-to-end translate flow that composes core, format-adapters, and ai-providers
  (config -> read -> diff -> translate -> write) with verbatra.lock.json as the
  change-detection baseline.

  The SDK adds no format, provider, or hashing logic of its own: it loads and zod-validates
  the config (cosmiconfig + cosmiconfig-typescript-loader, supporting a code-defined
  verbatra.config.ts via defineConfig and file-based configs, first-found-wins),
  selects an adapter by explicit format, constructs the configured provider (key read from
  env by the provider, never by the SDK), injects the selected adapter's own placeholder
  extractor into every translate request, routes the glossary term-map to the provider and
  surfaces provider notices, and reuses core's diffResources and contentHash.

  Per target locale it reads source + target, diffs against the lock-file baseline,
  translates only missing/changed keys (skipping invalid-ICU source), enforces per-key
  integrity (a failed key is withheld from the file and not lock-updated, so it retries),
  writes back preserving structure/order, and updates the lock-file. Locales are isolated:
  one locale's failure does not roll back others and the run continues. Dry-run reads + diffs

  - reports without constructing or calling the provider and without writing any file or the
    lock-file. Watch mode is intentionally deferred to a later slice.

- 1390e2d: Add watch mode: a long-running wrapper over the one-shot translate flow. It watches the configured
  source file, debounces filesystem events (300 ms default, configurable), and re-runs the existing
  one-shot `translate()` on each settled change. Runs are serialized and coalesced through an
  IDLE/RUNNING state machine with a single boolean pending-rerun flag: a change during a run never
  starts a concurrent run, and any number of mid-run changes collapse into exactly one immediate
  follow-up (no fresh debounce). Watch adds no translation, diff, or lock logic of its own - each run
  is the slice-1 flow unchanged, so the lock-file and per-locale atomic writes are reused as-is. An
  initial run happens on startup; a missing source path at startup is a hard `SOURCE_UNREADABLE`
  error, while a run that fails after start is reported and watching continues. Run summaries and
  failures are surfaced through a caller-supplied `onRun` callback (the SDK does no logging and puts
  no secret on the output path); the failed result carries only a secret-free `{code, message}`. The
  returned controller exposes `stop()`, which stops accepting triggers, discards any pending
  follow-up, closes the watcher, and awaits the in-flight run to completion (signal wiring such as
  SIGINT lives in the cli wrapper, not the SDK). New dependency: `chokidar` (pinned exact).
