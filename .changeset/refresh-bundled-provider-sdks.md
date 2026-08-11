---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Refresh the bundled provider SDKs to their current patch and minor releases.

`@anthropic-ai/sdk` moves from 0.115.0 to 0.116.0, `@google/genai` from 2.15.0 to 2.16.0, and
`openai` from 7.3.0 to 7.4.0. These are the versions a consumer installs alongside
`@verbatra/sdk`, so they reach the consumer lockfile, audit surface, and SBOM.

This is a routine dependency refresh with no verbatra API change: the provider strategies, the
shared `runLlmTranslation` layer, and the translation response schema are all untouched, and no
configuration or CLI behavior changes.
