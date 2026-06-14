---
"@verbatra/sdk": minor
---

Add an optional `configPath` to `loadConfig`'s options for loading one explicit config file instead
of searching. When given, the loader resolves the path (relative against `cwd`, absolute as-is) and
loads it through cosmiconfig's `load()`, which reuses the same loaders search uses (.json/.yaml/.ts via
the TypeScript loader), then validates it through the same zod boundary. A genuinely missing file is
`CONFIG_NOT_FOUND`; a present-but-unparseable or invalid file is `CONFIG_INVALID` — both existing
codes, no new error code. Precedence is `configOverride` > `configPath` > search. Purely additive: when
`configPath` is absent, `loadConfig` behaves exactly as before (the existing config-loading tests are
unchanged). This unblocks the CLI's `--config <path>` flag as a thin pass-through.
