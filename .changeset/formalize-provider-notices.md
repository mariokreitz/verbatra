---
"@verbatra/ai-providers": minor
"@verbatra/sdk": minor
---

Move `ProviderNotice` and `ProviderNoticeCode` onto the shared `TranslateResult` type instead of
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
