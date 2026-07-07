---
"@verbatra/sdk": minor
---

Add support for `glossary` as a path to a JSON file, in addition to the existing inline object. A relative path resolves against the directory of the loaded config file (or against the working directory when the config is passed as an in-memory override). The file is read once at load time, bounded to 1 MiB, and validated to the same flat string-to-string shape as the inline form; a missing file, oversized file, non-UTF-8 content, invalid JSON, or the wrong shape is a config error naming the resolved path. This is config-loading only: every downstream consumer (the translation flow, `watch`, the CLI) keeps receiving the same resolved plain object it always did.

This also adds an additive `loadConfigWithMeta` export that returns the resolved config alongside where it was loaded from and where its glossary came from, and exports the as-authored `VerbatraConfigInput` type (used by `defineConfig`) alongside the existing resolved `VerbatraConfig` type. `loadConfig` itself is unchanged in signature and behavior. `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
