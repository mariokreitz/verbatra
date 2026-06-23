---
"@verbatra/docs": patch
---

Document provider model autocompletion in the config and providers guides. The
config-file and providers pages now explain that, when the config is authored in
TypeScript with `defineConfig`, `provider.options.model` autocompletes the selected
provider's known model IDs (sourced from that provider's own SDK) while still
accepting any other string. Mirrored across the English, German, Spanish, and French
locales.
