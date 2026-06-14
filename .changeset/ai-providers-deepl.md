---
"@verbatra/ai-providers": minor
---

Add the DeepL provider, the final v1 provider and the first machine-translation (non-LLM) provider.
DeepL implements the existing TranslationProvider contract (kind "machine-translation") directly,
without the shared LLM layer — proving the interface is genuinely provider-shape-agnostic; the
TranslationProvider interface and the shared LLM layer are unchanged. It reuses the shared
mandatory-extractor gate, the per-key integrity check, ProviderError, and the env reader. Values are
sent as deepl-node's native ordered array and zipped back to keys by position (length mismatch ->
INVALID_RESPONSE, never silently zipped). Tone maps to formality with graceful free-key (":fx")
degradation; a configured glossary ID is passed natively while a generic term map is ignored — both
degradations surfaced as observable notices on the DeepL-specific result. The key is read only from
DEEPL_API_KEY, raw SDK/axios errors are never re-thrown, and the SDK's request logging is silenced.
deepl-node pinned 1.27.0; loglevel 1.9.2 added to silence the SDK's logger.
