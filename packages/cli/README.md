<p align="center">
  <img src="https://raw.githubusercontent.com/mariokreitz/verbatra/main/.github/assets/verbatra-mark.png" alt="verbatra logo, a glowing V mark on a dark square" width="96" height="96" />
</p>

<h1 align="center">@verbatra/cli</h1>

<p align="center">
  Command-line tool to automate i18n translation and keep your locale files in sync across languages with AI and machine-translation providers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verbatra/cli"><img src="https://img.shields.io/npm/v/@verbatra/cli?label=%40verbatra%2Fcli" alt="@verbatra/cli npm version" /></a>
  <a href="https://github.com/mariokreitz/verbatra/actions/workflows/ci.yml"><img src="https://github.com/mariokreitz/verbatra/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://codecov.io/gh/mariokreitz/verbatra"><img src="https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/mariokreitz/verbatra/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

## Description

`@verbatra/cli` provides the `verbatra` command: scaffold a config, translate every target locale, watch your source and re-translate as it changes, check or diff your locales without writing, or export and import an Excel workbook for manual translation. It is a thin wrapper over [`@verbatra/sdk`](https://github.com/mariokreitz/verbatra/tree/main/packages/sdk).

## Requirements

Node.js `>=22.14.0`.

## Installation

```bash
pnpm add -D @verbatra/cli
# npm
npm install -D @verbatra/cli
# yarn
yarn add -D @verbatra/cli
```

Invoke the binary through your package manager: `pnpm verbatra ...`, `npx verbatra ...`, or `yarn verbatra ...`.

## Quick start

```bash
# Scaffold verbatra.config.ts and .env.example
verbatra init --provider anthropic

# Provide the provider's API key (see the table below for each provider's variable)
export ANTHROPIC_API_KEY=your-key-here

# Translate every target locale once
verbatra translate

# Also remove orphaned keys (present in a target file, absent from source)
verbatra translate --prune
```

Plural-category generation is opt-in too, but config/SDK only: set `generatePlurals: true` in the config. Unlike `--prune`, there is no `--generate-plurals` flag (the SDK `translate()` input accepts a per-run override).

## Commands

verbatra ships seven commands: `init` (scaffold a config), `translate` (translate every target locale once), `watch` (re-translate on every source change), `check` (report per-locale missing, stale, and up-to-date counts without writing), `diff` (list the keys that would be added, re-translated, or are orphaned per locale, without writing), `export` (write untranslated strings to an Excel workbook for a human translator), and `import` (read the filled workbook back, with the same safety checks as `translate`). `check` and `diff` are read-only: they call no provider and write no file, so they suit CI gates. `export` and `import` are the manual-translation workflow, for the strings you want a human to translate. The full reference - every flag, examples, and the exit-code contract - lives on the documentation site:

- [CLI reference](https://verbatra.kreitz-webdev.de/docs/cli)
- [`verbatra init`](https://verbatra.kreitz-webdev.de/docs/cli/init)
- [`verbatra translate`](https://verbatra.kreitz-webdev.de/docs/cli/translate)
- [`verbatra watch`](https://verbatra.kreitz-webdev.de/docs/cli/watch)
- [`verbatra check`](https://verbatra.kreitz-webdev.de/docs/cli/check)
- [`verbatra diff`](https://verbatra.kreitz-webdev.de/docs/cli/diff)
- [`verbatra export`](https://verbatra.kreitz-webdev.de/docs/cli/export)
- [`verbatra import`](https://verbatra.kreitz-webdev.de/docs/cli/import)
- [Manual translation workflow](https://verbatra.kreitz-webdev.de/docs/manual-translation)

Run `verbatra <command> --help` for the same reference at the terminal.

## Exit codes

The CLI returns codes you can branch on in CI and scripts:

| Code | Meaning |
| --- | --- |
| `0` | Success (also `--help` and `--version`); for `check` and `diff`, every locale is in sync. |
| `1` | `translate` or `import` finished, but at least one locale failed; for `check` and `diff`, at least one locale is out of sync. |
| `2` | Could not run: a whole-run error or a usage error. |
| `130` | `watch` was force-stopped by a second interrupt (a single interrupt stops gracefully and exits `0`). |

A `watch` per-run failure is reported as an output record, not an exit code.

## API keys

Keys are read only from the environment, never from the config. Each provider reads one variable:

| Provider id | Environment variable |
| --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `deepl` | `DEEPL_API_KEY` |

`openai-compatible` is not in this table: most local servers need no key at all, and when one is required you name your own environment variable for it. See the [Providers page](https://verbatra.kreitz-webdev.de/docs/providers) for its key resolution.

`verbatra init` writes a `.env.example` and adds `.env` and `.env.local` to your `.gitignore`. `translate` and `watch` load `.env` from the working directory before running.

## Configuration

verbatra is configured with a `verbatra.config.ts`, a `.verbatrarc.json`, or a `"verbatra"` key in `package.json`. Run `verbatra init` to scaffold one. For the full configuration schema and a worked example, see the [`@verbatra/sdk` README](https://github.com/mariokreitz/verbatra/tree/main/packages/sdk) and the [project README](https://github.com/mariokreitz/verbatra).

## Documentation

- [Documentation site](https://verbatra.kreitz-webdev.de)
- [Project README](https://github.com/mariokreitz/verbatra)
- [`@verbatra/sdk`](https://github.com/mariokreitz/verbatra/tree/main/packages/sdk) for the programmatic API
- `verbatra <command> --help` for the command reference at the terminal

## License

[MIT](https://github.com/mariokreitz/verbatra/blob/main/LICENSE) (c) Mario Kreitz
