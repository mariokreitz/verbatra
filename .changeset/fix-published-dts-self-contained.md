---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix `defineConfig` and config authoring failing to typecheck in consumer projects. The published `.d.ts` files imported unpublished `@verbatra/*` internals that do not exist in a consumer install, so the provider model types degraded to `never` and every `defineConfig` call failed with TS2769. The SDK declaration build now inlines those private workspace types, so the published declarations no longer reference `@verbatra/core`, `@verbatra/ai-providers`, or `@verbatra/format-adapters`. `defineConfig` now typechecks for every provider id with per-provider model autocomplete preserved.
