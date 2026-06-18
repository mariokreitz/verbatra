<h1 align="center">@verbatra/sdk</h1>

<p align="center">
  Programmatic API to automate i18n translation and keep your locale files in sync across languages with AI and machine-translation providers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verbatra/sdk"><img src="https://img.shields.io/npm/v/@verbatra/sdk?label=%40verbatra%2Fsdk" alt="@verbatra/sdk npm version" /></a>
  <a href="https://codecov.io/gh/mariokreitz/verbatra"><img src="https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/mariokreitz/verbatra/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

## Description

`@verbatra/sdk` is the engine behind verbatra: load and validate a config, run the one-shot translate flow over every target locale, or watch the source and re-translate on each change. The [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli) command is a thin wrapper over this package.

## Requirements

Node.js `>=22.14.0`.

## Installation

```bash
pnpm add -D @verbatra/sdk
# npm
npm install -D @verbatra/sdk
# yarn
yarn add -D @verbatra/sdk
```

## Quick start

```ts
import { loadConfig, translate } from "@verbatra/sdk";

// Discovers and validates verbatra.config.ts (or .verbatrarc.json, or a package.json "verbatra" key).
const config = await loadConfig();

// The provider reads its API key from the environment (e.g. ANTHROPIC_API_KEY). No key is passed.
const summary = await translate({ config });

console.log(`${summary.succeeded.length} locale(s) translated, ${summary.failed.length} failed`);
```

## Defining config

`defineConfig` is an identity helper that gives you full type inference while authoring `verbatra.config.ts`:

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

`files.pattern` must contain the `{locale}` token, and `targetLocales` must not include `sourceLocale`; both are enforced when the config is validated. The supported `format` values are `i18next-json`, `vue-i18n-json`, `next-intl-json`, and `ngx-translate-json`. OpenAI and Gemini take `{ model, maxOutputTokens }`; DeepL takes `{}` (with an optional `glossaryId`). API keys are never part of the config. Each provider reads its own environment variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPL_API_KEY`).

## API reference

### `defineConfig(config)`

Returns the config unchanged. It exists purely for type inference and editor autocomplete when authoring a code-defined config.

### `loadConfig(options?): Promise<VerbatraConfig>`

Discovers and validates the configuration. With no arguments it searches upward from the current working directory; `options` accepts `cwd`, an explicit `configPath`, or an in-memory `configOverride`. Resolves to the validated `VerbatraConfig`, and throws an `SdkError` if no config is found or it fails validation.

### `translate(input): Promise<RunSummary>`

Runs the one-shot read, diff, translate, write flow over every target locale. `input` is `{ config, cwd?, dryRun? }`. With `dryRun: true` it reads, diffs, and reports without calling the provider or writing anything. Resolves to a `RunSummary` (`dryRun`, `locales`, `succeeded`, and `failed`).

```ts
const preview = await translate({ config, dryRun: true });
```

### `watch(input): Promise<WatchController>`

Watches the source file and re-runs the translate flow on each debounced change. `input` is `{ config, cwd?, debounceMs?, onRun }`, where `onRun` receives a `WatchRunResult` per run. Resolves to a `WatchController` whose `stop()` closes the watcher and awaits the in-flight run.

```ts
import { loadConfig, watch } from "@verbatra/sdk";

const config = await loadConfig();
const controller = await watch({
  config,
  onRun: (result) => console.log(result.status),
});

// Stop cleanly on Ctrl-C.
process.on("SIGINT", () => void controller.stop());
```

## Errors and results

The SDK throws a single structured error type, `SdkError`, for whole-run failures such as a missing or invalid config or an unreadable source file. It carries a stable `code` and never contains an API key. Per-locale failures do not throw: they are recorded on the `RunSummary` so one failing locale never aborts the others.

## Documentation

- [Documentation site](https://verbatra.kreitz-webdev.de)
- [Project README](https://github.com/mariokreitz/verbatra)
- [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli) for the command-line tool

## License

[MIT](https://github.com/mariokreitz/verbatra/blob/main/LICENSE) (c) Mario Kreitz
