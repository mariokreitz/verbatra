---
"@verbatra/sdk": minor
---

Fix the DeepL provider silently mishandling two boundary cases it never checked. First, a locale code DeepL's API does not accept (a regional source code like `en-US`, when only the base code is valid as a DeepL source; or a deprecated bare target code like `en` or `pt` that DeepL requires disambiguated) now fails fast with a structured `INVALID_REQUEST` error naming the rejected code, instead of reaching DeepL and surfacing as an opaque generic provider failure. A locale code DeepL does accept, including a title-case script subtag like `zh-Hans`, passes through unchanged.

Second, the DeepL provider now chunks its own outgoing requests to stay within DeepL's documented per-request caps (50 texts, 128 KiB of payload), independent of and in addition to the existing `maxBatchSize` config. Previously a `maxBatchSize` above DeepL's real cap (its default of 50 happened to match, but any larger configured value did not) reached `translateText` unchunked and failed only at the provider. A sub-batch that already fits in one request is sent exactly as before; only an over-cap sub-batch is now split into multiple sequential requests and merged back transparently.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
