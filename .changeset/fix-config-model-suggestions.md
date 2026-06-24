---
"@verbatra/sdk": patch
---

fix(config): scope provider model autocomplete to the selected provider

`defineConfig` is now generic over the provider id and infers it from the nested
`provider.id` literal, so the authoring config collapses to the single selected
provider's variant. `provider.options.model` then offers only that provider's known
model IDs as completions instead of every provider's models. The collapse removes the
nested discriminated-union narrowing that some editors (for example the
JetBrains/WebStorm completion engine) do not perform, so per-provider completions are
editor-robust. This is a type-only DX change: the runtime schema stays
`z.string().min(1)`, `defineConfig` still returns `VerbatraConfig`, unknown model IDs are
still accepted, and DeepL (no model field) is unchanged.
