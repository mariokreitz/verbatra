# @verbatra/sdk

## 0.5.0-next.1

### Minor Changes

- 54a641a: Add a new provider id `openai-compatible` for pointing verbatra at a local or self-hosted OpenAI-compatible inference server (LM Studio, Ollama, vLLM). Configure it with `{ baseUrl, model, maxOutputTokens, apiKeyEnvVar? }`; `baseUrl` is validated as an absolute http or https URL at config-parse time, and lives in config rather than the environment since it is a network address, not a secret. It must include your server's API path segment (typically `/v1`, the same convention the underlying client already uses for the hosted `openai` provider).

  The API key still never lives in config. It resolves in three tiers: an explicitly named `apiKeyEnvVar` (throws a clear error if that variable is unset), then the new convention variable `OPENAI_COMPATIBLE_API_KEY`, then the non-secret placeholder `"local"` for servers that need no key at all. `apiKeyEnvVar` cannot name any of the four hosted providers' environment variables, and the new provider's client never reads `OPENAI_API_KEY` or shares any code path with the hosted `openai` provider, so a hosted key can never reach a custom `baseUrl`.

  The request body uses the same strict, schema-constrained response format as the hosted `openai` provider (verified against a live LM Studio server); the one difference is that this provider tolerantly extracts the first brace-balanced JSON object anywhere in the response before parsing, since a local or smaller model can still wrap an otherwise-correct answer in prose or a ```json block despite the constraint. The extraction is string-aware, so prose or Markdown fence characters before, after, or even embedded inside a translated string value never defeat it. Its output still runs through the exact same canonical schema validation and placeholder and ICU integrity checks as every other provider.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged, and `verbatra init` does not yet offer `openai-compatible` as a scaffold option (it has no single required environment variable, unlike every other provider).

- 400e044: Providers now classify a failed translation call by HTTP status code or SDK error class instead of collapsing every failure into one opaque error: a 429 or an equivalent rate-limit error class surfaces as `RATE_LIMITED`, a network or request timeout as `TIMEOUT`, and a 401 or 403 as `AUTH_FAILED`, with the prior generic code kept as the fallback for anything unclassified. Classification never inspects error message text, so nothing provider-specific or key-shaped can leak through it. A caller-initiated cancellation (via `AbortSignal`) is now re-thrown as an abort instead of being wrapped as a provider error, so it can be told apart from a real failure; abort detection correlates the caught error's own identity with the signal instead of trusting the signal's `aborted` flag alone, so an unrelated failure that merely coincides with the signal being aborted is still classified and redacted, never passed through raw.

  The Gemini provider now retries a transient rate limit or server error with backoff before giving up, closing a gap where a single transient failure could kill an entire translation sub-batch (the other three v1 providers already retry through their own SDKs).

  A translation request can now carry an optional cancellation signal, threaded down into each provider's underlying call where the provider's SDK supports it. This is additive: `@verbatra/sdk`'s own APIs are unchanged in behavior, and `@verbatra/cli` (version-locked with `@verbatra/sdk`) picks up the same bump with no behavior change of its own.

### Patch Changes

- 14e9719: Fix ICU plural/select placeholder-integrity checking (next-intl and ARB) to compare source and target
  branch by matched branch instead of flattening each side into one multiset first. The prior flattening
  strategy dropped any placeholder confined to only some branches of a value before the comparison ever ran,
  which meant a fabricated placeholder invented in a single branch of a translated ARB or next-intl value
  (for example, only in a richer target locale's `few` or `many` CLDR category) could pass the integrity
  check undetected. The new comparison walks matched plural/select nodes branch by branch: a category present
  on both sides is checked directly, so an invention or a drop confined to one branch is caught precisely; a
  category only the target's richer cardinality supplies is checked for fabricated content against the union
  of every source branch, so a translator legitimately reusing a placeholder that appears in only one source
  branch is never wrongly rejected. This closes the gap for the LLM and DeepL provider translation paths and
  for workbook import, the two live call sites that resolve an ICU-capable format adapter.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is
  unchanged.

- 440212e: Reject a lock-file whose `version` does not match the version this build of verbatra
  understands. `readLockFile` previously validated the lock-file's shape but never compared its
  `version` field to the current supported version, so a lock-file written by an incompatible
  future (or otherwise mismatched) verbatra build was read and reinterpreted as if it were the
  current format, then rewritten still stamped with the wrong version, silently corrupting or
  misinterpreting the recorded baselines. A version mismatch now throws the same structured
  `LOCK_FILE_INVALID` error already used for a corrupt or oversized lock-file, naming the found and
  expected version numbers.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own
  behavior is unchanged.

- 2fe16b2: Harden the XLIFF adapter's XML handling. Two trans-units resolving to the same key (typically a
  duplicate `id`, or a positional fallback colliding with a real id) now raise `INVALID_STRUCTURE`
  instead of silently dropping one entry on read and misdirecting a translation to both units on
  write. The DTD and entity rejection already applied to XLIFF files on read now also applies to
  translated values before they are re-parsed as XML fragments on write, closing a gap where a
  malicious value could smuggle a DOCTYPE or entity declaration past the existing guard. Translated
  values are also filtered against an allow-list of genuine XLIFF inline elements (`x`, `g`, `bx`,
  `ex`, `ph`, `it`, `mrk`), each carrying no namespace or the genuine XLIFF 1.2/2.0 document
  namespace, and each restricted to its own minimal, non-executable set of attributes (`id`, and
  where applicable `rid`, `ctype`, `pos`, or `mtype`). A value containing any other element, an
  allow-listed element under any other namespace, a CDATA section, a comment, a processing
  instruction, or an attribute outside that element's allow-list (such as `onclick` or
  `xlink:href`) now degrades entirely to a plain text node, the same fallback already used for
  unbalanced markup, instead of reaching the written file as live markup or an unfiltered attribute.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own
  behavior is unchanged.

- b945e53: Fix the workbook decompressed-byte guard over-counting binary parts on import. The guard measured
  each entry's decompressed size by re-encoding the entry's UTF-8-decoded text with
  `Buffer.byteLength`, but decoding is lossy for a binary part (a thumbnail, embedded image, or any
  non-UTF-8 workbook part): every invalid byte becomes the replacement character U+FFFD, which is 3
  bytes wide, so the re-encoded count could overstate the true decompressed size by up to roughly 3x.
  A legitimate translated workbook carrying such a part could be wrongly rejected with a
  `WORKBOOK_INVALID` error even though it never actually exceeded the configured limit. The guard now
  sums the true raw decompressed byte count as it streams each entry, so the cap is checked against
  what the entry actually decompresses to.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
  is unchanged.

## 0.5.0-next.0

### Minor Changes

- 5597f98: Add support for `glossary` as a path to a JSON file, in addition to the existing inline object. A relative path resolves against the directory of the loaded config file (or against the working directory when the config is passed as an in-memory override). The file is read once at load time, bounded to 1 MiB, and validated to the same flat string-to-string shape as the inline form; a missing file, oversized file, non-UTF-8 content, invalid JSON, or the wrong shape is a config error naming the resolved path. This is config-loading only: every downstream consumer (the translation flow, `watch`, the CLI) keeps receiving the same resolved plain object it always did.

  This also adds an additive `loadConfigWithMeta` export that returns the resolved config alongside where it was loaded from and where its glossary came from, and exports the as-authored `VerbatraConfigInput` type (used by `defineConfig`) alongside the existing resolved `VerbatraConfig` type. `loadConfig` itself is unchanged in signature and behavior. `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.

- 4a789ff: Add `lockState`, a read-only sibling of `check` and `diff` that reports the translation lock-file's existence, version, and per-locale drift (recorded key count plus missing, stale, and up-to-date counts against the current source and target files) without calling a provider, writing any file, or touching the lock. Its `exists` field is always the result of an explicit check for the lock-file on disk, so a project that has never been translated is reported distinctly from one whose lock-file is present but empty.

  Also export `loadLockFile`, a thin wrapper for reading the project's lock-file directly, along with the `LockFile` type and the `LOCK_FILE_NAME` constant. `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.

## 0.4.4

### Patch Changes

- 8591e82: Fix the ARB adapter silently erasing all `@`-prefixed metadata (`@@locale`, and every `@key` description and placeholder block) when the destination file existed but could not be parsed. A destination write used to treat "file missing" (a legitimate first write) and "file present but corrupt, too large, or the wrong shape" identically, discarding metadata in both cases with no error. A missing destination still writes messages only, as before. A destination that exists but is not a usable ARB object now throws a structured error instead of silently proceeding, so a merge-conflicted or half-edited ARB file is surfaced as an error rather than causing silent metadata loss on the next translate run. The change lives in the private `@verbatra/format-adapters` package, so the observable behavior surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked).
- 43e3dbe: Fix `importWorkbook` advancing a locale's lock baseline for a changed key whose workbook cell was left blank, which permanently hid drift from `check` and `diff`.

  Previously, a changed source key with an empty translation cell fell through the row classification unresolved (neither accepted nor withheld), and the lock baseline was still advanced to the current source hash. The target file kept the translation of the old source, but `check` and `diff` reported the locale as in sync forever.

  Now only keys actually accepted this run advance their lock baseline. Every other source-present key, including a row left blank on a changed key, keeps its prior baseline hash so drift keeps being reported until the row is filled or the source reverts. This applies uniformly to a single blank row and to an entirely blank workbook across every locale.

  This adds `BLANK_ROW_BASELINE_RETAINED` as an additive member of the exported `SdkNoticeCode` union on `@verbatra/sdk`. A locale summary that retains a baseline this way now carries a notice with that code. The behavior fixed is a defect, so the bump stays patch, but the addition to the public type is called out here as deliberate.

- 714324f: Fix ICU plural and select placeholders being counted once per branch instead of once per argument, which rejected correct translations into languages with more CLDR plural categories than the source. English plural messages have one/other (2 branches), but Polish requires one/few/many/other (4) and Arabic requires zero/one/two/few/many/other (6); a correctly translated argument repeated in every required branch used to inflate the placeholder count and trip a false placeholder-integrity mismatch. A placeholder present in every branch of a plural or select now counts as one argument regardless of branch count, while a placeholder missing from any branch (a genuine translation drop) and a placeholder invented in the translation still fail integrity as before. The change lives in the private `@verbatra/format-adapters` package (the ICU analyzer used by the next-intl and ARB adapters), so the observable behavior surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked).
- f3f47ad: Fix the ngx-translate path-notation flatten silently dropping or restructuring translations on a
  key collision. A dotted flat key (`"a.b": "value"`) and a nested path (`"a": { "b": "value" }`)
  that resolved to the same final path used to silently overwrite each other during a read, losing
  one of the two values with no error; the flatten step now throws a structured `INVALID_STRUCTURE`
  error instead. Separately, a nested object key that itself contains a literal dot (for example
  `"a.b": { "c": "value" }`) used to write back restructured or merged with an unrelated key, since
  the dot inside the object key was indistinguishable from a path separator; such a file is now
  rejected as `MIXED_STRUCTURE` before any flattening happens. The literal-leaf adapters (i18next,
  vue-i18n, next-intl) already rejected the equivalent collision; ngx-translate now has the same
  guarantee. The change lives in the private `@verbatra/format-adapters` package, so the observable
  behavior surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked).
- e8a1e1d: Fix Excel translation cells being type-coerced on import. The Translation column produced by `exportWorkbook` (and the SDK's workbook export) now carries an explicit text number format, so Excel treats whatever a translator types as literal text. Previously the column had no number format, so Excel's default "General" format silently coerced typed values: a leading-zero code like "007" lost its zero, a decimal like "1.10" lost its trailing zero, a value like "3/4" was reformatted as a date, a long numeric id lost precision or turned into scientific notation, and a value starting with "=", "+", "-", or "@" (for example a phone number or a note) was parsed as a formula and imported as its formula result or an error string instead of the intended text.
- 75f54cb: Fix plural-form generation ignoring maxBatchSize and one failure discarding a whole locale run. Stale plural-generation items are now split into sequential sub-batches no larger than maxBatchSize, matching main translation batching. A sub-batch whose provider call throws now withholds only its own forms instead of aborting the locale run, so already-accepted main translations and other successful plural sub-batches are written as before.
- d119616: Stop reporting a failed provider call as an integrity mismatch. When a translation sub-batch throws (for example a revoked API key, a rate limit, or a network timeout), the run now reports the affected keys under a new `providerFailures` bucket on the per-locale summary instead of folding them into `integrityMismatches`, which is documented as "translated keys that failed the placeholder-integrity check" and is misleading here since nothing was translated. The `SUB_BATCH_FAILED` notice for that sub-batch now also carries the caught failure's code and message when it is a genuine `ProviderError` (secret-free by construction); any other thrown value still falls back to a static, generic message so nothing unvetted can leak through.

  This adds `providerFailures` as an additive member of the exported `LocaleSummary` type on `@verbatra/sdk`. The behavior fixed is a defect, so the bump stays patch, but the addition to the public type is called out here so it is deliberate. `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.

## 0.4.3

### Patch Changes

- 0470883: Accept reordered placeholders that carry the same multiset instead of withholding them as integrity failures. Translations that legitimately reorder placeholders for a target language (for example German, Japanese, or Arabic word order) are now written on every path (LLM and DeepL runs, plural-form generation, and workbook import) rather than being rejected and re-attempted on each run.
- 55fc543: Harden workbook import against a maliciously crafted archive. The importer behind `verbatra import` (and the SDK `importWorkbook`) now streams each archive entry through a memory-bounded reader and stops as soon as the decompressed size passes the configured limit, so a high-ratio compressed workbook is rejected with a clear error instead of exhausting memory. Previously such a workbook could be fully inflated before the size check ran, which could exhaust process memory when importing an untrusted file.
- 3b6d79f: Stop DeepL from burning quota looping on placeholder-bearing strings. DeepL cannot preserve placeholders or ICU tokens, so entries that contain them are now left untranslated (withheld) instead of being sent to DeepL, mangled, and re-attempted on every run. Such entries are reported through a new `PLACEHOLDER_UNSUPPORTED` notice; use an LLM provider to translate placeholder-bearing strings. Placeholder-free strings translate exactly as before. The change lives in the private `@verbatra/ai-providers` package, so the observable behavior change surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked). The new `PLACEHOLDER_UNSUPPORTED` code is an additive member of the provider notice-code union, reachable on the public type surface through the exported `LocaleNotice` type (the per-locale `notices` on a `RunSummary`). The fix is a defect fix so the bump stays patch, but the addition to the public type is called out here so it is deliberate.
- c525929: Fix a false green in the CI drift gates: `check`, `diff`, and `export` now reject an empty or unknown `--locales` value instead of silently exiting 0.

  A `--locales` value that normalizes to an empty list (for example `""` or `","`) is now a usage error that exits 2, and a requested locale that is not among the configured target locales is rejected as a whole-run error naming the unknown locale(s) rather than being silently dropped.

  This adds `UNKNOWN_LOCALE` as an additive member of the exported `SdkErrorCode` union on `@verbatra/sdk`. The behavior fixed is a defect, so the bump stays patch, but the new code is called out here so the addition to the public type is deliberate.

## 0.4.2

### Patch Changes

- 2ac8ad6: Remediate open npm audit advisories with pnpm overrides. Lifts the transitive uuid copy bundled through exceljs to >=11.1.1 (GHSA-w5hq-g745-h8pq) on the published path, and the dev-only js-yaml (GHSA-h67p-54hq-rp68, to the patched v3 line) and esbuild (GHSA-g7r4-m6w7-qqqr) copies. No source or public API change; this records the change to the resolved dependency tree of the published packages.

## 0.4.1

### Patch Changes

- 792c889: Fix `defineConfig` and config authoring failing to typecheck in consumer projects. The published `.d.ts` files imported unpublished `@verbatra/*` internals that do not exist in a consumer install, so the provider model types degraded to `never` and every `defineConfig` call failed with TS2769. The SDK declaration build now inlines those private workspace types, so the published declarations no longer reference `@verbatra/core`, `@verbatra/ai-providers`, or `@verbatra/format-adapters`. `defineConfig` now typechecks for every provider id with per-provider model autocomplete preserved.

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
