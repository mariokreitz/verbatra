---
"@verbatra/ai-providers": patch
"@verbatra/sdk": patch
---

Add provider model autocompletion to config authoring, sourced from the installed
provider SDK types. Each LLM provider now exports a model type (`AnthropicModel`,
`OpenAiModel`, `GeminiModel`) taken directly from that provider SDK's own published
model type, so the single source of truth is the installed SDK and there is no
hand-maintained list to drift. `defineConfig` surfaces those IDs as editor completions
for `provider.options.model`, narrowed by the selected `provider.id`. This is a
type-only DX change: the suggestions are an open union that still accepts any other
string, the runtime schema stays `z.string().min(1)`, and there is no runtime behavior
change.
