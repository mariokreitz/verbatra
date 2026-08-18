---
"@verbatra/ai-providers": patch
"@verbatra/sdk": patch
---

Refresh the bundled `deepl-node` package (1.27.0 to 1.28.0) pinned in the `bundled` pnpm catalog.
`@verbatra/sdk` bundles `@verbatra/ai-providers` into its published dist, so this exact version
ships to every consumer of `@verbatra/sdk` and `@verbatra/cli`.

Routine upstream minor release with no consumer-facing breaking change. `@verbatra/cli` is
version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
