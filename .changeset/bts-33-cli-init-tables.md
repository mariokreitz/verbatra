---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Centralize the CLI `init` lookup tables behind an SDK scaffolding-metadata surface and consolidate the one-shot whole-run error scaffold. This is a behavior-preserving refactor: the scaffolded `verbatra.config.ts`, `.env.example`, and `.gitignore` bytes are identical, and every command exit code (`0`, `1`, `2`, `130`) is unchanged.

`@verbatra/sdk` gains one additive, read-only export, `scaffoldingMetadata` (provider id to env var, LLM provider id to a cosmetic default scaffold model, and the supported format ids), plus a re-exported `SupportedFormat` type. The values are sourced from `@verbatra/core` (format ids) and `@verbatra/ai-providers` (provider env vars and scaffold models); the SDK assembles a pass-through and owns no copy. A `Record<ProviderId, string>` compile guard ties the env-var table to the canonical provider union.

The CLI `init` command now reads provider ids, env-var names, and default models from `scaffoldingMetadata` instead of hand-maintained local tables, so a provider, env-var, model, or format-id change in a lower package breaks the CLI build instead of silently drifting. The `FORMAT_BY_DEP` npm-dependency-to-format detection map stays CLI-local by design, with its format ids typed against `SupportedFormat`. The repeated load-config plus try/catch plus `return 2` scaffold in `runTranslate`, `runExport`, `runImport`, `runCheck`, and `runDiff` is consolidated into one `withWholeRunErrors` helper; `runWatch` keeps its own streaming error model and the `130` force-stop path.

The new SDK export is internal-facing and the change is behavior-preserving, so this is a patch on the version-locked `sdk` and `cli` pair. The private `core` and `ai-providers` packages ship no changeset.
