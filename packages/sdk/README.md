<p align="center">
  <img src="https://raw.githubusercontent.com/mariokreitz/verbatra/main/.github/assets/verbatra-mark.png" alt="verbatra logo, a glowing V mark on a dark square" width="96" height="96" />
</p>

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

`@verbatra/sdk` is the engine behind verbatra: load and validate a config, run the one-shot translate flow over every target locale, watch the source and re-translate on each change, check or diff your locales without writing, or export and import an Excel workbook for manual translation. The [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli) command is a thin wrapper over this package.

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
      model: "claude-sonnet-4-6", // replace with your provider's model id
      maxTokens: 4096,
    },
  },
});
```

`files.pattern` must contain the `{locale}` token, and `targetLocales` must not include `sourceLocale`; both are enforced when the config is validated. The supported `format` values are `i18next-json`, `vue-i18n-json`, `next-intl-json`, `ngx-translate-json`, `xliff`, `yaml`, and `arb`. The optional `glossary` (a term map) and `tone` (`"formal"`, `"informal"`, or `"neutral"`) refine the output. The optional `prune` boolean (off by default) opts in to removing orphaned keys (present in a target file but absent from the source) from the written target files and the lock; the `translate --prune` flag overrides it per run. The optional `generatePlurals` boolean (off by default) opts in to synthesizing the CLDR plural forms a richer target language requires but the source lacks (i18next-JSON projects translated by an LLM provider only; DeepL, non-i18next formats, and unknown languages fall back to the per-locale plural warning and never fail); a per-run `generatePlurals` override on `translate` takes precedence, and generated keys are reported separately from translated keys on the summary. OpenAI and Gemini take `{ model, maxOutputTokens }`; DeepL takes `{}` (with an optional `glossaryId`). API keys are never part of the config. Each provider reads its own environment variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPL_API_KEY`).

## API reference

### `defineConfig(config)`

Returns the config unchanged. It exists purely for type inference and editor autocomplete when authoring a code-defined config. The `model` field is restricted to the selected provider's known model IDs (sourced from that provider's own SDK), so a model from another provider is a type error at authoring time; the runtime still validates `model` only as a non-empty string, so an unlisted model runs even though the editor flags it.

### `loadConfig(options?): Promise<VerbatraConfig>`

Discovers and validates the configuration. With no arguments it searches upward from the current working directory; `options` accepts `cwd`, an explicit `configPath`, or an in-memory `configOverride`. Resolves to the validated `VerbatraConfig`, and throws an `SdkError` if no config is found or it fails validation.

### `translate(input): Promise<RunSummary>`

Runs the one-shot read, diff, translate, write flow over every target locale. `input` is `{ config, cwd?, dryRun?, prune?, generatePlurals? }`. With `dryRun: true` it reads, diffs, and reports without calling the provider or writing anything. `prune` and `generatePlurals` each override the matching config option for this run. Resolves to a `RunSummary` (`dryRun`, `locales`, `succeeded`, and `failed`); each locale summary lists `translated`, `generated`, `pruned`, `integrityMismatches`, and `notices`.

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

### `check(input): Promise<CheckSummary>`

Reports per-locale drift without calling a provider, writing any file, or touching the lock. `input` is `{ config, cwd?, locales? }`, where `locales` narrows the check to a subset of target locales (defaults to all configured). Resolves to a `CheckSummary` whose `locales` lists one `LocaleCheckSummary` each (counts only: `missing`, `stale`, `upToDate`, and a per-locale `inSync`); the top-level `inSync` is true only when every checked locale is in sync.

```ts
import { check, loadConfig } from "@verbatra/sdk";

const config = await loadConfig();
const summary = await check({ config });

if (!summary.inSync) {
  console.log("Locales are out of sync; run verbatra translate.");
}
```

### `diff(input): Promise<DiffSummary>`

Lists the keys a run would touch, without writing anything. `input` is the same `{ config, cwd?, locales? }` shape as `check`. Resolves to a `DiffSummary` whose `locales` lists one `LocaleDiff` each, with the key arrays `missing` (would be added), `changed` (would be re-translated), and `orphaned` (present in the target but absent from the source).

```ts
import { diff, loadConfig } from "@verbatra/sdk";

const config = await loadConfig();
const summary = await diff({ config });
```

### `exportWorkbook(input): Promise<ExportWorkbookResult>`

Exports the strings that need translating into a styled Excel workbook for a human translator. `input` is `{ config, cwd?, out?, locales?, includeUnchanged? }`. By default it writes the missing and changed strings for every target locale to `verbatra-translations.xlsx`; `out` overrides the path, `locales` narrows which target locales are exported, and `includeUnchanged: true` also exports already up-to-date strings. Resolves to an `ExportWorkbookResult` with the written `path` and a per-locale row count.

### `importWorkbook(input): Promise<RunSummary>`

Imports a filled workbook back into the locale files, running the same placeholder and ICU checks as `translate`. `input` is `{ config, workbook, cwd?, dryRun? }`. With `dryRun: true` it validates and reports without writing locale files or updating the lock. Resolves to a `RunSummary`, the same shape `translate` returns.

```ts
import { exportWorkbook, importWorkbook, loadConfig } from "@verbatra/sdk";

const config = await loadConfig();

// Export the strings that need translating to an Excel workbook.
const { path } = await exportWorkbook({ config });

// ...a human fills the Translation column, then import the file back.
const summary = await importWorkbook({ config, workbook: path });
```

See [Manual translation](https://verbatra.kreitz-webdev.de/docs/manual-translation) for the full round-trip and the workbook layout.

## Errors and results

The SDK throws a single structured error type, `SdkError`, for whole-run failures such as a missing or invalid config or an unreadable source file. It carries a stable `code` and never contains an API key. Per-locale failures do not throw: they are recorded on the `RunSummary` so one failing locale never aborts the others.

## Documentation

- [Documentation site](https://verbatra.kreitz-webdev.de)
- [Project README](https://github.com/mariokreitz/verbatra)
- [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli) for the command-line tool

## License

[MIT](https://github.com/mariokreitz/verbatra/blob/main/LICENSE) (c) Mario Kreitz
