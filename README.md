<h1 align="center">verbatra</h1>

<p align="center">
  Automate i18n translation and keep your locale files in sync across languages with AI and machine-translation providers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verbatra/cli"><img src="https://img.shields.io/npm/v/@verbatra/cli" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@verbatra/sdk"><img src="https://img.shields.io/npm/v/@verbatra/sdk" alt="npm" /></a>
  <a href="https://codecov.io/gh/mariokreitz/verbatra"><img src="https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg" alt="Coverage" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

## Description

verbatra translates your application's locale files for you. You maintain the source locale by hand, and as strings are added or change, verbatra fills in every target locale through the AI or machine-translation provider you choose. It records what it has already translated, so each run touches only what actually changed.

It ships in two packages. `@verbatra/cli` gives you a `verbatra` command for the terminal and CI, and `@verbatra/sdk` is the same engine as a programmatic API. verbatra is built SDK-first: the CLI is a thin wrapper over the SDK, so anything the command line does, you can also do in code.

## Features

- **JSON locale files** for i18next, vue-i18n, next-intl, and ngx-translate.
- **Four providers** behind one interface: Anthropic, OpenAI, and Gemini (LLMs), plus DeepL (machine translation).
- **Incremental by default.** A lock file records what has been translated, so each run sends only new or changed strings to the provider.
- **Project scaffolding.** `verbatra init` writes a config and a `.env.example` for your project.
- **Dry runs.** `--dry-run` previews what would change without calling a provider or writing files.
- **Watch mode.** `verbatra watch` re-translates automatically on every source change.
- **Placeholder integrity.** Every translation is checked after the fact; a result that drops or alters a placeholder is withheld and reported rather than written.
- **Keys stay in your environment.** API keys are read only from environment variables, never from the config.

## Requirements

Node.js `>=22.14.0`.

## Installation

verbatra is a development dependency:

```bash
pnpm add -D @verbatra/cli
# npm
npm install -D @verbatra/cli
# yarn
yarn add -D @verbatra/cli
```

## Quick start

```bash
# 1. Install as a dev dependency
pnpm add -D @verbatra/cli

# 2. Scaffold verbatra.config.ts and .env.example (choose your provider)
verbatra init --provider anthropic

# 3. Provide the provider's API key. init created .env.example and gitignored
#    .env, so you can set it in .env, or export it (Anthropic shown):
export ANTHROPIC_API_KEY=your-key-here

# 4. Translate every target locale once
verbatra translate
```

Invoke the binary through your package manager: `pnpm verbatra ...`, `npx verbatra ...`, or `yarn verbatra ...`.

## Configuration

verbatra looks for its configuration upward from the working directory: a `verbatra.config.ts`, a `.verbatrarc.json` (and the other `.verbatrarc.*` variants), or a `"verbatra"` key in `package.json`. The quickest way to get a valid one is `verbatra init`. A minimal `verbatra.config.ts`:

```ts
import { defineConfig } from "@verbatra/sdk";

export default defineConfig({
  sourceLocale: "en",
  targetLocales: ["de", "fr"],
  format: "i18next-json",
  files: {
    pattern: "locales/{locale}.json",
  },
  provider: {
    id: "anthropic",
    options: {
      model: "<your-model>", // replace with your provider's model id
      maxTokens: 4096,
    },
  },
});
```

`files.pattern` must contain the `{locale}` token, and `targetLocales` must not include `sourceLocale`. The supported `format` values are `i18next-json`, `vue-i18n-json`, `next-intl-json`, and `ngx-translate-json`. The optional `glossary` (a term map) and `tone` (`"formal"`, `"informal"`, or `"neutral"`) refine the output.

The `provider` block is selected by `id`. The LLM providers take a `model` and a token limit; DeepL needs no model:

```ts
// OpenAI / Gemini
provider: { id: "openai", options: { model: "<your-model>", maxOutputTokens: 4096 } }

// DeepL (machine translation)
provider: { id: "deepl", options: {} }
```

Each provider reads its API key from one environment variable:

| Provider id | Environment variable |
| --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `deepl` | `DEEPL_API_KEY` |

## Commands

| Command | What it does | Common flags |
| --- | --- | --- |
| `verbatra init` | Create a verbatra config and .env example for this project | `--provider <id>`, `--source`, `--targets`, `--path`, `--yes`, `--force` |
| `verbatra translate` | Translate every target locale once, then exit | `--cwd`, `--config`, `--dry-run`, `--json` |
| `verbatra watch` | Re-translate on every source change until interrupted | `--cwd`, `--config`, `--debounce <ms>`, `--json` |

Run `verbatra <command> --help` for the full option list. The complete command reference lives in the [`@verbatra/cli` README](./packages/cli/README.md).

## Programmatic use

Everything the CLI does is available from `@verbatra/sdk`:

```ts
import { loadConfig, translate } from "@verbatra/sdk";

// Discovers and validates verbatra.config.ts (or .verbatrarc.json, or a package.json "verbatra" key).
const config = await loadConfig();

// The provider reads its API key from the environment (e.g. ANTHROPIC_API_KEY). No key is passed.
const summary = await translate({ config });

console.log(`${summary.succeeded.length} locale(s) translated, ${summary.failed.length} failed`);
```

See the [`@verbatra/sdk` README](./packages/sdk/README.md) for the full API.

## Packages

| Package | Description |
| --- | --- |
| [`@verbatra/cli`](./packages/cli/README.md) | The `verbatra` command-line tool. |
| [`@verbatra/sdk`](./packages/sdk/README.md) | The programmatic API. |

## Security

API keys are read only from environment variables, never from the config file. The config schema rejects unknown keys, so a key cannot hide there by accident, and `verbatra init` adds `.env` and `.env.local` to your `.gitignore`. To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Documentation

The hosted documentation site is at [verbatra.kreitz-webdev.de](https://verbatra.kreitz-webdev.de). Each package also documents its own surface: the [`@verbatra/cli` README](./packages/cli/README.md) for the command line and the [`@verbatra/sdk` README](./packages/sdk/README.md) for the programmatic API. At the terminal, `verbatra <command> --help` prints the same reference.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md) first.

## License

[MIT](./LICENSE) (c) Mario Kreitz
