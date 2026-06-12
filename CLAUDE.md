# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

verbatra is an i18n translation automation tool. Open source; English is the project
language for all code, comments, and documentation.

## Project state

This is a freshly scaffolded monorepo. The only real package today is `@verbatra/config`
(shared build/TS/lint config). The product packages described below (`core`, `sdk`, `cli`,
`format-adapters`, `ai-providers`) do **not exist yet** — they are the planned v1+ shape.
Before building a feature, read its spec under `docs/specs/` (e.g. `docs/specs/core.md`) and
the architecture in `docs/fundament-architektur.md` (German). Note: `docs/` is gitignored
local planning material, not shipped source.

## Commands

Run from the repo root (pnpm + Turborepo orchestrate per-package tasks):

- `pnpm build` — `turbo run build` across all packages (tsup → ESM+CJS+dts in `dist/`)
- `pnpm test` — `turbo run test` (Vitest)
- `pnpm lint` — `turbo run lint` (Biome per package)
- `pnpm check` — `biome check .` (lint + format, whole repo)
- `pnpm format` — `biome format --write .`
- `pnpm changeset` — add a changeset (required for any package change that should publish)

Single package / single test:

- `pnpm --filter @verbatra/core build` — one package only
- `pnpm vitest run path/to/file.test.ts` — one test file
- `pnpm vitest run -t "name of test"` — tests matching a name

Requires Node `>=22.14.0` and pnpm `>=11`.

## Architecture

The dependency graph is strictly acyclic, inner → outer. Arrows point at what is imported:

```
config  ←  core  ←  format-adapters
                 ←  ai-providers
                          ↓
                         sdk  ←  cli / github-action / framework-adapters
```

Rules that hold the design together:

- **`core` is the pure domain center**: domain model (TranslationEntry, LocaleResource,
  SupportedFormat), diffing (missing / stale / orphaned / unchanged keys), content hashing,
  placeholder-integrity comparison, and validation reporting. It performs **no I/O, no
  network, no file system**, knows nothing about specific formats or providers, and imports
  nothing from `sdk`/`cli`. It only operates on data handed to it. Placeholder *extraction*
  and ICU *parsing* are explicitly not core's job — core compares placeholder sets and
  aggregates ICU-validity results it is given.
- **`format-adapters`** convert files ↔ a format-neutral intermediate representation
  (Reader/Writer/Parser per format). v1 is JSON only: i18next, vue-i18n, next-intl, ngx-translate.
- **`ai-providers`** are Strategy implementations behind a registry. v1 providers: OpenAI,
  Anthropic (`@anthropic-ai/sdk`), Gemini (`@google/genai`), DeepL.
- **`sdk`** is the public programmatic API; it orchestrates core + adapters + providers.
- **`cli`, `github-action`, `framework-adapters`** are pure consumers of `sdk` and must not
  reach around it into core/adapters/providers directly.

v1 scope is deliberately lean: `core` + `sdk` + `cli`, JSON formats only, the four providers
above. GitHub Action is v1.1; editor extensions are post-v1.

## Conventions enforced by tooling

- **TypeScript is maximally strict** (see `packages/config/tsconfig.base.json`):
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
  `isolatedModules`, NodeNext modules. Write code that satisfies these — e.g. indexed access
  is `T | undefined`, and type-only imports must use `import type`.
- **Biome** is the linter/formatter (config in `packages/config/biome.json`): double quotes,
  always semicolons, trailing commas everywhere, 2-space indent, 100-col width. `any` is an
  **error** (`noExplicitAny`); cognitive complexity is capped at 15.
- **Conventional Commits** are enforced by commitlint via the `commit-msg` lefthook. The
  `pre-commit` hook runs `biome check` on staged files. Keep commits scoped and conventional.
- New publishable packages should extend `@verbatra/config` (tsconfig, biome, and the
  `createTsupConfig` preset) rather than redefining build/lint settings.

## Roles workflow

Work is done through five role lenses, one hat at a time (full definitions in
`docs/roles/`): Product Owner (spec + acceptance criteria, guards v1 scope), Developer
(implements against spec with tests, does not self-approve), Code Reviewer (independent
correctness/architecture review), QA (behavior vs. acceptance criteria), Security (audit
against the threat model: key leakage, prompt injection from translatable strings,
placeholder integrity, supply chain, CI/CD). Run review/QA/security as separate passes so
they stay independent.