---
"@verbatra/sdk": patch
---

fix(config): restrict the provider model field to the selected provider's known models

`defineConfig` is now declared as one overload per provider id, each taking that
provider's concrete authoring config. Overload resolution picks the variant from the
`provider.id` literal, so `provider.options.model` is restricted to that provider's known
model IDs: the editor offers only those models, and a foreign or unknown model (for
example a Claude model under `id: "gemini"`) is a type error at authoring time. Concrete
per-provider signatures avoid the generic/nested-discriminated-union inference that some
editors (notably the JetBrains/WebStorm completion engine) do not perform and that
otherwise makes them fall back to offering every provider's models. This is a type-only
DX change: the runtime schema stays `z.string().min(1)` (a model the installed provider
SDK does not yet list is flagged in the editor but still runs), `defineConfig` still
returns `VerbatraConfig`, and DeepL (no model field) is unchanged.
