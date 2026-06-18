<h1 align="center">@verbatra/cli</h1>

<p align="center">
  Command-line tool to automate i18n translation and keep your locale files in sync across languages with AI and machine-translation providers.
</p>

<p align="center">
  <a href="https://codecov.io/gh/mariokreitz/verbatra"><img src="https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/mariokreitz/verbatra/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

## Description

`@verbatra/cli` provides the `verbatra` command: scaffold a config, translate every target locale, or watch your source and re-translate as it changes. It is a thin wrapper over [`@verbatra/sdk`](https://github.com/mariokreitz/verbatra/tree/main/packages/sdk).

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
```

## Commands and options

### `verbatra init`

Create a verbatra config and .env example for this project.

| Option | Description |
| --- | --- |
| `--cwd <path>` | write the config and env files to this directory |
| `--provider <id>` | translation provider to use: anthropic, openai, gemini, or deepl (required unless prompted) |
| `--source <locale>` | locale your source strings are written in (default en) |
| `--targets <locales>` | comma-separated locales to translate into (default de) |
| `--path <pattern>` | locale file pattern containing the {locale} token (default locales/{locale}.json) |
| `--yes` | skip prompts and accept the defaults |
| `--force` | overwrite an existing config or .env.example |

### `verbatra translate`

Translate every target locale once, then exit.

| Option | Description |
| --- | --- |
| `--cwd <path>` | resolve config and locale files from this directory |
| `--config <path>` | load this config file instead of searching for one |
| `--dry-run` | preview changes without calling a provider or writing files |
| `--json` | print the run summary as JSON |

### `verbatra watch`

Re-translate on every source change until interrupted.

| Option | Description |
| --- | --- |
| `--cwd <path>` | resolve config and locale files from this directory |
| `--config <path>` | load this config file instead of searching for one |
| `--debounce <ms>` | wait this many milliseconds after a change before translating (default 300) |
| `--json` | print each run as one NDJSON record |

Run `verbatra <command> --help` for the same reference at the terminal.

## Exit codes

verbatra uses exit codes as its CI and scripting contract:

| Code | Meaning |
| --- | --- |
| `0` | success |
| `1` | `translate` finished but some locales failed (translate only) |
| `2` | could not run (a whole-run error, or a usage error) |
| `130` | `watch` was force-stopped by a second interrupt |

## API keys

Keys are read only from the environment, never from the config. Each provider reads one variable:

| Provider id | Environment variable |
| --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `deepl` | `DEEPL_API_KEY` |

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
