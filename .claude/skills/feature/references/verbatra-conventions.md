# verbatra project conventions (shared reference)

Every role in this plugin treats the rules below as binding. They come from the
verbatra project definition. When a deliverable would violate one of these, stop
and route the issue back rather than shipping around it.

## Language and style (applies to all repository content)

- All repository content (code, comments, documentation, commit messages, spec
  files, audit notes) is written in English. English overrides any other default.
- No emojis. No decorative formatting. Natural writing style.
- Em dashes (the U+2014 character) must never appear anywhere in the repository.
  Use a spaced hyphen, a colon, or parentheses instead. This is a hard rule and
  it also applies to anything this team writes into the repo.

## Repository

- github.com/mariokreitz/verbatra. Open source, MIT, npm scope `@verbatra`.
- The connected GitHub tool is read-only here: it can read issues, pull requests,
  and code, but it cannot branch, push, or open pull requests. Deliver all code by
  writing to the local mounted repository, not through GitHub.

## Architecture (binding)

- pnpm workspaces monorepo with Turborepo (task orchestration and caching) and
  Changesets (publishing). Node >=22.14.0, pinned pnpm@11.6.0.
- SDK-first: `@verbatra/sdk` is the central API. `@verbatra/cli` and
  `@verbatra/github-action` are thin wrappers. Published packages are
  `@verbatra/sdk` and `@verbatra/cli`; the others are internal or private.
- Acyclic dependency direction:
  config <- core <- format-adapters / ai-providers / exchange <- sdk <- cli /
  github-action / framework-adapters. Never import against the arrow. Never
  introduce a cycle.
- Abstract provider layer (Strategy + Factory + Registry) for OpenAI, Anthropic,
  Gemini (@google/genai), and DeepL. The three LLM providers run through the shared
  `runLlmTranslation` layer with one canonical zod schema fed to each SDK's
  structured-output mechanism. DeepL is an MT API and implements `translateBatch`
  directly, reusing only cross-cutting pieces. All providers sit behind one
  shape-agnostic `TranslationProvider` interface resolved through a
  `ProviderRegistry`.
- Format-adapter pattern (Reader / Writer / Parser) over a format-neutral
  intermediate representation. v1 is JSON only with four adapters: i18next,
  vue-i18n, next-intl, ngx-translate. All are built on the single
  `createJsonFileAdapter` factory and registered via `createDefaultRegistry`.
  XLIFF, YAML, and ARB come later. When adding a format, build on the factory and
  register it. Do not reimplement read, write, or detection.

## Packages

- `@verbatra/config` shared build, TS, and lint config (tsconfig base, Biome
  config, tsup preset).
- `@verbatra/core` pure domain center (model, diffing, hashing, placeholder
  integrity, validation). No I/O, no network, no file system. Depends only on zod.
- `@verbatra/format-adapters` file to neutral-IR adapters for JSON i18n formats.
- `@verbatra/ai-providers` translation provider strategies behind a registry.
- `@verbatra/sdk` central orchestration API: one-shot `translate()`, long-running
  `watch()`, config loading.
- `@verbatra/cli` the `verbatra` binary, a thin wrapper over the SDK.
- `@verbatra/github-action` composite action that runs the CLI in CI (v1.1).
  Private, consumed via `uses:`, not published to npm.
- `apps/docs` Fumadocs (Next.js) documentation site.

## Code principles

- Strict TypeScript: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes,
  verbatimModuleSyntax, isolatedModules, NodeNext. No `any` (Biome noExplicitAny is
  an error). Cognitive complexity capped at 15.
- DRY, KISS, SOLID. Clear, descriptive names. Low LOC per function and per file,
  enforced by lint rules.
- zod at all boundaries (config, CLI args, action inputs, provider responses).
  Keep zod out of hot paths.
- Biome for format and most linting. ESLint only for type-aware rules.
- Tests with Vitest, co-located as `*.test.ts`. 90% coverage thresholds on lines,
  functions, statements, and branches in CI.
- Conventional Commits required (commitlint + lefthook). Any publishable `src`
  change ships a changeset. New publishable packages extend `@verbatra/config`
  rather than redefining build or lint settings.

## Security (high priority)

- API keys only from env (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY,
  DEEPL_API_KEY) via the readers in `ai-providers/src/env.ts`. Never from config
  files, CLI args, or function arguments. Never commit, never log. Route anything
  that could contain a key through `redact()`.
- Errors are structured `ProviderError`s, never raw SDK errors.
- Prompt-injection boundary: system rules are compile-time constants; all untrusted
  input travels only in the user-turn JSON payload. Provider output is schema-bound
  and validated. Placeholder and ICU integrity is enforced after every translation.
  Treat translatable strings as untrusted.
- npm Trusted Publishing via OIDC (no NPM_TOKEN), automatic provenance,
  `repository.url` must match exactly. Least-privilege GITHUB_TOKEN, action pinning
  to commit SHA. The lockfile is committed.

## v1 scope (deliberately lean)

- core + sdk + cli, JSON formats, four providers.
- CLI commands implemented today: `init`, `translate`, `watch`, `export`, `import`.
  (`check` and `diff` are planned but not yet implemented.)
- Do not build everything at once. Keep changes within v1 scope unless the brief
  explicitly expands it, and flag scope expansion to the product owner.
