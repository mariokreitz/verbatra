---
"@verbatra/ai-providers": minor
---

Introduce @verbatra/ai-providers with the provider abstraction (TranslationProvider interface,
request/response shapes, ProviderRegistry) and the Anthropic reference provider. The Anthropic
provider translates a batch in a single forced tool-use request, separates instructions from
untrusted data, validates the response and per-key placeholder integrity via core's check using a
mandatory injected extractor, reads its key only from ANTHROPIC_API_KEY, and surfaces structured,
secret-free errors. JSON formats; one provider (Anthropic) in this slice.
