---
"@verbatra/ai-providers": patch
"@verbatra/sdk": patch
---

Fix the `openai-compatible` provider against Mistral and other OpenAI-compatible servers that expect `max_tokens` rather than OpenAI's newer `max_completion_tokens` field. The shared Chat Completions request builder previously hardcoded `max_completion_tokens` for every caller, including `openai-compatible`, so every request against a server that rejects that field (Mistral's chat completions API answers with HTTP 422, "Extra inputs are not permitted") failed outright. The `openai-compatible` provider now sends `max_tokens` instead, the field understood broadly across LM Studio, Ollama, vLLM, and hosted OpenAI-compatible APIs such as Mistral's; the hosted `openai` provider is unaffected and still sends `max_completion_tokens`.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
