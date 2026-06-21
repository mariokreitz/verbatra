# Contributing to verbatra

Thanks for your interest in contributing. verbatra is an i18n translation
automation tool built as a pnpm + Turborepo monorepo. This guide describes the
setup, commands, and conventions this repository actually enforces.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
To report a security issue, follow [SECURITY.md](SECURITY.md); please do not
open a public issue for vulnerabilities.

## Prerequisites

- Node.js >= 22.14.0
- pnpm >= 11 (the repository pins pnpm 11.6.0 via the `packageManager` field; run
  `corepack enable` to use the pinned version)

## Setup

Clone the repository and install dependencies from the root:

```
pnpm install
```

This installs every workspace package and sets up the Git hooks (lefthook
installs them during install). If the hooks are not active, run
`pnpm exec lefthook install` once.

## Commands

Run all commands from the repository root; Turborepo orchestrates the per-package
tasks.

- `pnpm build` - build all packages
- `pnpm test` - run the test suites (Vitest) with coverage
- `pnpm lint` - lint all packages (Biome)
- `pnpm check` - run Biome lint and format checks across the repository
- `pnpm format` - apply Biome formatting

Run a task for a single package with a filter, for example:

```
pnpm --filter @verbatra/core test
```

## Tests and coverage

Tests use Vitest and live next to the code as `*.test.ts` files. Coverage is
collected with the v8 provider, and every package enforces a 90% threshold on
lines, functions, statements, and branches. New behavior ships with tests and
must keep coverage at or above that threshold.

## Commit convention

This repository uses [Conventional Commits](https://www.conventionalcommits.org),
enforced by commitlint (`@commitlint/config-conventional`) through the
`commit-msg` Git hook. Write subjects as `type(scope): summary`, for example
`feat(cli): add init command`. Commit body and footer lines must not exceed 100
characters (the configured `body-max-line-length` and `footer-max-line-length`).

The `pre-commit` hook runs Biome on staged files, so format and lint problems are
caught before a commit is created. If the hook reports issues, run `pnpm check`
to see them or `pnpm format` to auto-fix, then re-stage.

## Changesets

If your change touches the `src` of a publishable package and should ship in a
release, add a changeset:

```
pnpm changeset
```

Describe the change and select the affected package(s) and bump type. Changes
that do not affect published packages (for example internal tooling) do not need
one.

## Pull requests

1. Branch from `main`.
2. Make your change with tests, and keep it focused.
3. Ensure `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally.
4. Use Conventional Commit messages.
5. Add a changeset if a publishable package changed.
6. Open a pull request with the template, describing what changed and how you
   tested it. Keep the pull request scoped and make sure CI is green.

A maintainer will review your pull request. Please be responsive to feedback, and
hold to the standards in the [Code of Conduct](CODE_OF_CONDUCT.md).

## Adding a provider or a format adapter

Step-by-step guides for adding a new translation provider or a new format adapter
are not yet written. Open an issue or a draft pull request to discuss the design
first: format adapters build on the shared `createJsonFileAdapter` factory and
register in the adapter registry, providers implement the `TranslationProvider`
interface behind the provider registry, and both must respect the repository's
inner-to-outer dependency graph (never import against it).
