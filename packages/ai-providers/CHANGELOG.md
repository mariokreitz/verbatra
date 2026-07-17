# @verbatra/ai-providers

## 0.2.0

### Minor Changes

- 565eb89: Move `ProviderNotice` and `ProviderNoticeCode` onto the shared `TranslateResult` type instead of
  DeepL's own extended result shape, and add an optional `notices` field to `TranslateResult` itself.
  Every provider now populates it as a present array: DeepL reports its real graceful-degradation
  notices (`FORMALITY_DOWNGRADED`, `GLOSSARY_IGNORED`, `PLACEHOLDER_UNSUPPORTED`), and every LLM
  provider (Anthropic, OpenAI, Gemini, openai-compatible) returns an empty array rather than omitting
  the field. The SDK's internal notice reader is now a plain, typed accessor over this field instead of
  a duck-typed structural cast, so a provider-side rename or shape change is now caught by the
  compiler instead of silently returning no notices.

  Also fixes DeepL's `supportsGlossary` flag, which is a behavior change worth calling out explicitly:
  it previously reported `true` unconditionally, even though DeepL only ever applies a pre-created
  native glossary id, never the SDK's generic source-term to target-term map. Supplying a term map
  without a configured native glossary id already produced a `GLOSSARY_IGNORED` notice; the flag was
  simply lying about it. `supportsGlossary` now reports `true` only when a native `glossaryId` is
  configured, and `false` for the generic term-map-only case. This is not a regression: DeepL's actual
  glossary behavior is unchanged, and nothing in the SDK gates glossary data on this flag, so a
  supplied term map still flows through to DeepL (and is still ignored with the same notice) exactly
  as before.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
  is unchanged.

## 0.2.0-next.0

### Minor Changes

- 565eb89: Move `ProviderNotice` and `ProviderNoticeCode` onto the shared `TranslateResult` type instead of
  DeepL's own extended result shape, and add an optional `notices` field to `TranslateResult` itself.
  Every provider now populates it as a present array: DeepL reports its real graceful-degradation
  notices (`FORMALITY_DOWNGRADED`, `GLOSSARY_IGNORED`, `PLACEHOLDER_UNSUPPORTED`), and every LLM
  provider (Anthropic, OpenAI, Gemini, openai-compatible) returns an empty array rather than omitting
  the field. The SDK's internal notice reader is now a plain, typed accessor over this field instead of
  a duck-typed structural cast, so a provider-side rename or shape change is now caught by the
  compiler instead of silently returning no notices.

  Also fixes DeepL's `supportsGlossary` flag, which is a behavior change worth calling out explicitly:
  it previously reported `true` unconditionally, even though DeepL only ever applies a pre-created
  native glossary id, never the SDK's generic source-term to target-term map. Supplying a term map
  without a configured native glossary id already produced a `GLOSSARY_IGNORED` notice; the flag was
  simply lying about it. `supportsGlossary` now reports `true` only when a native `glossaryId` is
  configured, and `false` for the generic term-map-only case. This is not a regression: DeepL's actual
  glossary behavior is unchanged, and nothing in the SDK gates glossary data on this flag, so a
  supplied term map still flows through to DeepL (and is still ignored with the same notice) exactly
  as before.

  `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
  is unchanged.

## 0.1.3

### Patch Changes

- 182e226: Harden provider error redaction. Extend `redact()` key-shape coverage to all four v1 providers: the OpenAI and Anthropic `sk-` prefixes (word-boundary anchored so ordinary words like "risk-" pass through), Google Gemini `AIza` keys, and DeepL hex UUID keys with the optional `:fx` free-tier suffix. Wire `redact()` into the `ProviderError` constructor as a defense-in-depth backstop that pattern-scrubs every message.

  Provider errors stay secret-free by construction, which remains the primary control: `guardProviderCall` discards any caught SDK error and throws a static `ProviderError`, and `env.ts` names a missing variable but never its value. On the live paths every message is a compile-time constant, so the backstop scrub is a no-op and there is no behavior change. Every pattern is linear and ReDoS-safe.

  This is internal hardening in a private, bundled package. There is no public `@verbatra/sdk` or `@verbatra/cli` API change and no observable behavior change on any live path, so the published packages are intentionally not versioned here.

- 99c2020: Make DeepL log suppression robust to a loglevel dependency split. The deepl-node SDK logs request and response content at debug through a loglevel logger named "deepl"; suppression now silences both our own loglevel import and the loglevel instance deepl-node itself resolves, so untranslated source content stays suppressed even if pnpm stops deduplicating loglevel to a single instance. deepl-node and loglevel are now grouped in the Dependabot update policy so they bump together. By-construction key handling is unchanged: the auth key is never passed to a log call. No public API or behavior change; @verbatra/sdk and @verbatra/cli are intentionally not versioned.

## 0.1.2

### Patch Changes

- 609fc41: fix(ai-providers): surface output-token truncation as a distinct, actionable error

  When a translation batch exceeds the configured output-token budget, the OpenAI
  (`finish_reason === "length"`), Anthropic (`stop_reason === "max_tokens"`), and Gemini
  (`MAX_TOKENS`) providers now fail with a structured `ProviderError` carrying the new
  `OUTPUT_TRUNCATED` code and a fixed, secret-free message that names the remedy: reduce the batch
  size or raise the configured max output tokens. Detection runs before the body is parsed, so a
  truncated-but-valid JSON body still reports truncation rather than a key-reconciliation error. A
  caller can branch on `ProviderError.code` to distinguish truncation from a generic malformed
  response; the wording is identical across all three LLM providers.

- Updated dependencies [c2871a9]
- Updated dependencies [4fd6165]
  - @verbatra/core@0.1.1

## 0.1.1

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

## 0.1.0

### Minor Changes

- 151dd3c: Introduce @verbatra/ai-providers with the provider abstraction (TranslationProvider interface,
  request/response shapes, ProviderRegistry) and the Anthropic reference provider. The Anthropic
  provider translates a batch in a single forced tool-use request, separates instructions from
  untrusted data, validates the response and per-key placeholder integrity via core's check using a
  mandatory injected extractor, reads its key only from ANTHROPIC_API_KEY, and surfaces structured,
  secret-free errors. JSON formats; one provider (Anthropic) in this slice.
- a820cd5: Add the DeepL provider, the final v1 provider and the first machine-translation (non-LLM) provider.
  DeepL implements the existing TranslationProvider contract (kind "machine-translation") directly,
  without the shared LLM layer - proving the interface is genuinely provider-shape-agnostic; the
  TranslationProvider interface and the shared LLM layer are unchanged. It reuses the shared
  mandatory-extractor gate, the per-key integrity check, ProviderError, and the env reader. Values are
  sent as deepl-node's native ordered array and zipped back to keys by position (length mismatch ->
  INVALID_RESPONSE, never silently zipped). Tone maps to formality with graceful free-key (":fx")
  degradation; a configured glossary ID is passed natively while a generic term map is ignored - both
  degradations surfaced as observable notices on the DeepL-specific result. The key is read only from
  DEEPL_API_KEY, raw SDK/axios errors are never re-thrown, and the SDK's request logging is silenced.
  deepl-node pinned 1.27.0; loglevel 1.9.2 added to silence the SDK's logger.
- 53e2831: Add the Gemini provider as the third LLM on the shared LLM layer. It supplies only its own mechanism
  behind the existing LlmMechanism extension point, with no change to the shared layer or the
  TranslationProvider interface. Gemini uses @google/genai (generateContent with
  config.responseMimeType + config.responseSchema); the responseSchema is a dialect transform of the
  single canonical derivation (deriveJsonSchema), so all three providers derive from one source. Output
  is re-validated on our side by the shared reconcile; blocked, empty, and safety-filtered responses
  surface as a new PROVIDER_BLOCKED error (distinct from PROVIDER_REFUSED); the key is read only from
  GEMINI_API_KEY; raw SDK errors are never re-thrown. @google/genai pinned 2.8.0.
- 56a8f76: Add the OpenAI provider and extract a shared internal LLM scaffolding layer. The shared layer owns
  the provider-agnostic flow (structured data payload, canonical per-key result schema as a single
  source of truth, response validation and key-set reconciliation, post-translation integrity,
  secret-free errors, key-from-env) behind one mechanism extension point. Anthropic is reimplemented on
  the shared layer (forced tool-use as its mechanism, tool schema derived from the canonical schema),
  behavior-preserving. OpenAI uses Chat Completions Structured Outputs with a json_schema derived from
  the same canonical schema, re-validated with zod on our side, refusals surfaced as a distinct
  PROVIDER_REFUSED error, key read only from OPENAI_API_KEY, and SDK request logging suppressed.

### Patch Changes

- Updated dependencies [bde1174]
- Updated dependencies [7aeaca7]
  - @verbatra/core@0.1.0
