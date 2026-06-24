---
"@verbatra/sdk": patch
---

fix(config): restrict the provider model field to the selected provider's known models

`defineConfig` is now generic over the provider id and infers it from the nested
`provider.id` literal, so the authoring config collapses to the single selected
provider's variant. `provider.options.model` is then restricted to that provider's known
model IDs: the editor offers only those models, and a foreign or unknown model (for
example a Claude model under `id: "gemini"`) is a type error at authoring time. Closing
the union also removes the nested discriminated-union narrowing that some editors (for
example the JetBrains/WebStorm completion engine) do not perform, so the restriction is
reported as a compiler diagnostic and holds editor-side, not only in tsserver. This is a
type-only DX change: the runtime schema stays `z.string().min(1)` (a model the installed
provider SDK does not yet list is flagged in the editor but still runs), `defineConfig`
still returns `VerbatraConfig`, and DeepL (no model field) is unchanged.
