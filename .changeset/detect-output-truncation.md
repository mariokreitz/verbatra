---
"@verbatra/ai-providers": patch
---

fix(ai-providers): surface output-token truncation as a distinct, actionable error

When a translation batch exceeds the configured output-token budget, the OpenAI
(`finish_reason === "length"`), Anthropic (`stop_reason === "max_tokens"`), and Gemini
(`MAX_TOKENS`) providers now fail with a structured `ProviderError` carrying the new
`OUTPUT_TRUNCATED` code and a fixed, secret-free message that names the remedy: reduce the batch
size or raise the configured max output tokens. Detection runs before the body is parsed, so a
truncated-but-valid JSON body still reports truncation rather than a key-reconciliation error. A
caller can branch on `ProviderError.code` to distinguish truncation from a generic malformed
response; the wording is identical across all three LLM providers.
