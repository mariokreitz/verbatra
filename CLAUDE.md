# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

verbatra is an i18n translation-automation tool. It is open source; English is the project
language for all code, comments, and documentation.

## Project state

This is a pnpm + Turborepo + Changesets monorepo. The packages implemented today are:

- `@verbatra/config` - shared build/TS/lint config (tsconfig base, Biome config, tsup preset).
- `@verbatra/core` - the pure domain center (model, diffing, hashing, placeholder integrity,
  validation).
- `@verbatra/format-adapters` - file to neutral-IR adapters for JSON i18n formats (i18next,
  vue-i18n, next-intl, ngx-translate).
- `@verbatra/ai-providers` - translation provider strategies behind a registry (OpenAI, Anthropic,
  Gemini, DeepL).
- `@verbatra/exchange` - translator interchange: a neutral, format-agnostic row model turned into a
  styled `.xlsx` workbook (`buildWorkbook`) and back (`readWorkbook`), for manual translation.
  Depends on `core` only, composed by `sdk`.
- `@verbatra/sdk` - the central orchestration API: one-shot `translate()`, long-running `watch()`,
  manual-translation `exportWorkbook()` / `importWorkbook()`, and config loading (`loadConfig`,
  including an explicit `configPath`).
- `@verbatra/cli` - the `verbatra` binary, a thin wrapper over the SDK. Commands: `translate`,
  `watch`, `export`, `import`, `init`.
- `@verbatra/github-action` - a composite action that runs the CLI in CI (v1.1). Private (consumed
  via `uses:`), not published to npm.

Note: any `docs/` directory (specs, architecture notes, the `docs/cowork/` team operating system)
is **gitignored, local-only** planning material and is not present in a fresh clone. Do not rely on
it or point instructions at it. This file is self-contained.

## Commands

Run from the repo root (pnpm + Turborepo orchestrate per-package tasks):

- `pnpm build` - `turbo run build` across all packages (tsup to ESM+CJS+dts in `dist/`)
- `pnpm test` - `turbo run test` (Vitest with v8 coverage)
- `pnpm lint` - `turbo run lint` (Biome per package)
- `pnpm check` - `biome check .` (lint + format, whole repo)
- `pnpm format` - `biome format --write .`
- `pnpm changeset` - add a changeset (required for any package change that should publish)
- `pnpm release` - `changeset publish`

Single package / single test:

- `pnpm --filter @verbatra/core build` - one package only (also `test`, `lint`, `typecheck`)
- `pnpm --filter @verbatra/ai-providers typecheck` - type-check one package (`tsc --noEmit`)
- `pnpm vitest run path/to/file.test.ts` - one test file
- `pnpm vitest run -t "name of test"` - tests matching a name

Each package's `test` runs `vitest run --coverage` (v8 provider) with **90% thresholds** on
lines, functions, statements, and branches. Requires Node `>=22.14.0` and pnpm `>=11` (pinned
`pnpm@11.6.0`).

## Architecture

The dependency graph is strictly acyclic, inner to outer. Arrows point at what is imported;
never import against the arrow, and never introduce a cycle:

```
config  ←  core  ←  format-adapters
                 ←  ai-providers
                 ←  exchange
                          ↓
                         sdk  ←  cli / github-action / framework-adapters
```

- **`core` is the pure domain center**: domain model (`TranslationEntry`, `LocaleResource`,
  `SupportedFormat`), diffing (missing / stale / orphaned / unchanged keys), content hashing,
  placeholder-integrity comparison, and validation reporting. It performs **no I/O, no network,
  no file system**, knows nothing about specific formats or providers, and imports nothing from
  `sdk`/`cli`. It only operates on data handed to it, and depends only on `zod`. Placeholder
  *extraction* and ICU *parsing* are explicitly not core's job: core compares placeholder
  multisets and aggregates ICU-validity results it is given. Placeholder integrity is multiset
  (count) aware, so a dropped or duplicated placeholder is reported as missing/extra rather than a
  pure reorder, and the check always fails safe (a non-matching multiset is never `matches: true`).

- **`format-adapters`** convert files to and from a format-neutral intermediate representation. v1
  is JSON only: i18next, vue-i18n, next-intl, ngx-translate. All JSON adapters are built on the
  single `createJsonFileAdapter(options)` factory (`src/json/json-file-adapter.ts`) and registered
  in an `AdapterRegistry` via `createDefaultRegistry()`. Read, write, and detection are shared; only
  the format-specific parts vary (placeholder extraction, plural detection, ICU validity). ICU
  formats validate via `@formatjs/icu-messageformat-parser`. When adding a format, build on the
  factory and register it: do not reimplement read/write/detection.

- **`ai-providers`** are Strategy implementations behind a registry. The `TranslationProvider`
  interface (`src/provider.ts`) is resolved through a `ProviderRegistry`. The three LLM providers
  (Anthropic, OpenAI, Gemini) all run through the shared layer `runLlmTranslation(request,
  mechanism)` (`src/llm/run.ts`). There is one canonical zod schema, `translationsResultSchema`, as
  the single source of truth; `deriveJsonSchema` feeds it to each SDK's structured-output mechanism
  (Anthropic tool `input_schema`, OpenAI `json_schema`, Gemini `responseSchema`) so the model
  constraint and the validation cannot drift. When adding an LLM provider, build an `LlmMechanism`
  and delegate to `runLlmTranslation` rather than wiring a bespoke flow. DeepL is a
  machine-translation provider: it implements `translateBatch` directly and does NOT use the LLM
  layer, reusing only the cross-cutting pieces (request validation, batch integrity, error
  redaction), proof the provider interface is shape-agnostic, not over-fit to LLMs.

- **`exchange`** is the manual-translation interchange layer. It owns a neutral, format-agnostic
  row model and turns it into a styled `.xlsx` (`buildWorkbook`) and back (`readWorkbook`). It
  depends on `core` only and is composed by `sdk`; it imports nothing from `format-adapters`,
  `sdk`, or `cli`, runs no translation check, and touches no locale or lock file (the SDK does
  that). The xlsx library (exceljs) is confined to two internal modules and never appears on the
  public surface. A returned workbook is untrusted input: the parse is bounded (entry,
  decompressed-byte, sheet, row, and cell caps) and the XML is rejected if it declares a DTD or
  entity, with every structural problem surfacing as a structured, secret-free `ExchangeError`.

- **`sdk`** composes core/adapters/providers/exchange into the end-to-end flows and is the central
  API: `translate()`, `watch()`, `exportWorkbook()` / `importWorkbook()`, and `loadConfig()`.
  **`cli`** and **`github-action`** (and the post-v1 `framework-adapters` / editor extensions) are
  thin consumers of `sdk`: the cli wraps the SDK flows, the action runs the cli in CI. They must not
  reach around the SDK into core/adapters/providers/exchange directly, and they add no
  orchestration/translation/diff/lock logic of their own.

## Security invariants

These are properties of the actual code and must be preserved in any change:

- **Secrets come only from environment variables** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `GEMINI_API_KEY`, `DEEPL_API_KEY`) via the readers in `packages/ai-providers/src/env.ts`, never
  from config files, CLI args, or function arguments. Never log secrets. `redact()`
  (`packages/ai-providers/src/redaction.ts`) is a standalone utility for an explicit debug sink, not
  the active error path: provider errors are secret-free by construction (see next point), so
  nothing sensitive reaches a string that would need scrubbing.
- **Errors are structured**, never raw SDK errors (provider SDK errors can carry request headers /
  keys). `guardProviderCall` catches with an unbound `catch` and throws a static `ProviderError`,
  so the raw error is never bound, logged, or re-thrown. Other layers map to their own structured
  errors (`AdapterError`, `ExchangeError`, `SdkError`) the same way.
- **Prompt-injection boundary**: system rules are compile-time constants. All untrusted variable
  input (entries to translate, glossary, tone) travels only in the user-turn JSON data payload,
  never spliced into the instruction channel. Provider output is schema-bound and validated, and
  placeholder integrity is enforced after translation. Treat translatable strings as untrusted.
- **Untrusted file input is bounded.** Reads are TOCTOU-safe (one handle, `fstat`, bounded byte
  count) and writes are atomic (write to a uniquely named temp file in the same directory, then
  rename over the target). The workbook parse in `exchange` adds entry / decompressed-byte / sheet /
  row / cell caps and rejects DTD/entity declarations.
- **Supply chain**: the lockfile is committed, releases go through Changesets, and npm provenance
  is enabled (`publishConfig.provenance` in each publishable package).

## Conventions enforced by tooling

- **TypeScript is maximally strict** (`packages/config/tsconfig.base.json`):
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
  `isolatedModules`, NodeNext modules. Write code that satisfies these, e.g. indexed access is
  `T | undefined`, and type-only imports must use `import type`.
- **Biome** is the linter/formatter (`packages/config/biome.json`): double quotes, always
  semicolons, trailing commas everywhere, 2-space indent, 100-col width, organize-imports on.
  `any` is an **error** (`noExplicitAny`); cognitive complexity is capped at 15.
- **No em dashes anywhere.** The U+2014 character must never appear in any file (prose, code,
  comments, docs, changelogs, JSON). Use a spaced hyphen (` - `), a colon, parentheses, or a
  reworked sentence. English only, no emojis, no decorative formatting.
- **Validate at boundaries with `zod`** (config, file contents, provider responses); keep it out
  of hot paths.
- **Git hooks (lefthook)**: `pre-commit` runs `biome check` on staged JS/TS/JSON; `commit-msg`
  runs commitlint. **Conventional Commits** are required. Keep commits scoped and conventional.
- **Changesets**: any package `src/**` change that should publish ships a `.changeset/*.md`.
- **New publishable packages extend `@verbatra/config`** rather than redefining build/lint
  settings, e.g. `tsconfig.json` uses `"extends": "@verbatra/config/tsconfig.base.json"`, and
  `tsup.config.ts` is `import { createTsupConfig } from "@verbatra/config/tsup";
  export default createTsupConfig();`.
- **Tests** are Vitest, co-located as `*.test.ts`; new behavior ships with tests and keeps
  coverage at or above the 90% thresholds.
