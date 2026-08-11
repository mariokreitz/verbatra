<p align="center">
  <img src="https://raw.githubusercontent.com/mariokreitz/verbatra/main/.github/assets/verbatra-mark.png" alt="verbatra logo, a glowing V mark on a dark square" width="96" height="96" />
</p>

<h1 align="center">@verbatra/sdk</h1>

<p align="center">
  Programmatic API to automate i18n translation and keep your locale files in sync across languages with AI and machine-translation providers.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verbatra/sdk"><img src="https://img.shields.io/npm/v/@verbatra/sdk?label=%40verbatra%2Fsdk" alt="@verbatra/sdk npm version" /></a>
  <a href="https://github.com/mariokreitz/verbatra/actions/workflows/ci.yml"><img src="https://github.com/mariokreitz/verbatra/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://codecov.io/gh/mariokreitz/verbatra"><img src="https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/mariokreitz/verbatra/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

## Description

`@verbatra/sdk` is the engine behind verbatra: load and validate a config, run the one-shot translate flow over every target locale, watch the source and re-translate on each change, check or diff your locales without writing, or export and import an Excel workbook for manual translation. The [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli) command is a thin wrapper over this package.

## Requirements

Node.js `>=22.14.0`.

## Installation

```bash
npm install --save-dev @verbatra/sdk
# pnpm
pnpm add -D @verbatra/sdk
# yarn
yarn add -D @verbatra/sdk
```

## Quick start

```ts
import { loadConfig, translate } from "@verbatra/sdk";

// Discovers and validates verbatra.config.ts (or .verbatrarc.json, or a package.json "verbatra" key).
const config = await loadConfig();

// The provider reads its API key from the environment (e.g. GEMINI_API_KEY). No key is passed.
const summary = await translate({ config });

console.log(
  `${summary.succeeded.length} locale(s) done, ${summary.partial.length} partial, ${summary.failed.length} failed`,
);
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
    id: "gemini",
    options: {
      model: "gemini-2.5-flash", // replace with your provider's model id
      maxOutputTokens: 4096,
    },
  },
});
```

`files.pattern` must contain the `{locale}` token, `targetLocales` must not include `sourceLocale`, and `targetLocales` must not list the same locale twice, compared case-insensitively (two such entries would collide as one Excel worksheet on export); all three are enforced when the config is validated. The supported `format` values are `i18next-json`, `vue-i18n-json`, `next-intl-json`, `ngx-translate-json`, `xliff`, `yaml`, `arb`, and `properties`. JSON-family, YAML, and ARB files round-trip in exact document key order: integer-like keys keep their position, new keys append in source-document order, and a YAML composite key (a map or sequence used as a mapping key) fails with a structured error; a `.properties` write preserves the destination file's existing line endings. The optional `glossary` (a term map, inline or a path to a JSON file of the same shape) and `tone` (`"formal"`, `"informal"`, or `"neutral"`) refine the output. The optional `prune` boolean (off by default) opts in to removing orphaned keys (present in a target file but absent from the source) from the written target files and the lock; the `translate --prune` flag overrides it per run. The optional `generatePlurals` boolean (off by default) opts in to synthesizing the CLDR plural forms a richer target language requires but the source lacks (i18next-JSON projects translated by an LLM provider only; DeepL, non-i18next formats, and unknown languages fall back to the per-locale plural warning and never fail); a per-run `generatePlurals` override on `translate` takes precedence, and generated keys are reported separately from translated keys on the summary. The optional `maxBatchSize` (a positive integer, 50 when absent) caps how many entries go into a single provider request, so a large locale is split into sequential sub-batches and one oversized request cannot sink the whole locale. The optional `maxTokens` sets a whole-run ceiling on input plus output tokens across every provider call, and `budgetBehavior` decides what happens once it is reached: `"warn"` (the default) flags it and lets the run continue, `"stop"` withholds every not-yet-attempted key for the rest of the run so it retries next time. Both are config-only, have no CLI flag, and never change an exit code; against a token-less provider such as DeepL, which reports no usage, the budget stays inert rather than tripping falsely.

Anthropic takes `{ model, maxTokens }`; OpenAI and Gemini take `{ model, maxOutputTokens }`; `openai-compatible` takes the same pair plus a `baseUrl` (for a local or self-hosted server such as LM Studio, Ollama, or vLLM) and an optional `apiKeyEnvVar`; DeepL takes `{}` (with an optional `glossaryId`). Every provider additionally accepts an optional `requestTimeoutMs`, a positive-integer per-request timeout in milliseconds that bounds each outbound call. API keys are never part of the config. Each provider reads its own environment variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPL_API_KEY`; `openai-compatible` resolves its key from `apiKeyEnvVar`, then `OPENAI_COMPATIBLE_API_KEY`, then falls back to a keyless placeholder).

## API reference

### `defineConfig(config)`

Returns the config unchanged. It exists purely for type inference and editor autocomplete when authoring a code-defined config. For Anthropic, OpenAI, and Gemini the `model` field is restricted to that provider's known model IDs (sourced from its own SDK), so a model from another provider is a type error at authoring time; the runtime still validates `model` only as a non-empty string, so an unlisted model runs even though the editor flags it. DeepL has no `model` field, and `openai-compatible`'s model is whatever the local server exposes, so neither is restricted.

### `loadConfig(options?): Promise<VerbatraConfig>`

Discovers and validates the configuration. With no arguments it searches upward from the current working directory; `options` accepts `cwd`, an explicit `configPath`, an in-memory `configOverride`, and an `fs` seam. Precedence is `configOverride`, then `configPath`, then the search. Resolves to the validated `VerbatraConfig`, and throws an `SdkError` if no config is found (`CONFIG_NOT_FOUND`) or it fails validation (`CONFIG_INVALID`). A `glossary` given as a file path is read and validated here, so every downstream call receives a plain term map.

### `translate(input): Promise<RunSummary>`

Runs the one-shot read, diff, translate, write flow over every target locale. `input` is a `TranslateInput`: `{ config, cwd?, dryRun?, prune?, generatePlurals?, cache?, concurrency?, lockAcquireTimeoutMs?, onProgress?, onLockWait? }`. With `dryRun: true` it reads, diffs, and reports without calling the provider or writing anything. `prune` and `generatePlurals` each override the matching config option for this run.

`cache` (on by default, and ignored on a dry run) toggles the local content-addressed translation-memory cache in `verbatra.cache.json`: a key whose source content is unchanged, including under a renamed key or shared with another key, is served from the cache instead of being re-sent to the provider. A cached value is re-checked against that key's own current source first, and one that fails the gate falls through to the provider rather than being written. `concurrency` (defaults to 1, strictly serial) is how many target locales may run at once; it must be an integer of at least 1, and on a live run a value above 1 is refused when the config sets `maxTokens`, because concurrent locales would overshoot the budget nondeterministically. `lockAcquireTimeoutMs` overrides how long a locale's write lock keeps retrying before it fails. `onProgress` receives a structured event once per locale before and after it runs, once per provider sub-batch, and once when the locale loop ends; `onLockWait` fires while a locale's write lock is blocked on another process holding it. The SDK writes to no stream, so these callbacks are the only progress signal.

Resolves to a `RunSummary`: `dryRun`, `locales`, `succeeded`, `partial`, `failed`, plus `usage` when any provider call reported tokens and `budget` when `maxTokens` is configured. A locale's `status` is `"succeeded"` when nothing was withheld (a no-op with no candidate keys included), `"partial"` when it accepted at least one key and withheld at least one, and `"failed"` when it withheld keys and accepted none, or threw. Each `LocaleSummary` carries `locale`, `status`, `translated`, `unchanged`, `orphaned`, `pruned`, `invalidIcuSource`, `cacheHits`, `integrityMismatches`, `providerFailures`, `budgetWithheld`, `generated`, `notices`, `needsReview`, `unfilled`, `malformedRows`, `duplicateKeys`, an optional `usage`, and an optional `error` on a locale that threw. `cacheHits` are keys served from the translation-memory cache rather than the provider. `integrityMismatches` is a translation that came back and was withheld by verbatra's integrity gate, whose rejection reasons are the exported `IntegrityGateReason` union. `providerFailures` is a key withheld because nothing was translated for it (the provider call failed, or the response was still missing that key), with any secret-free failure code and message reported in `notices`. `budgetWithheld` is a candidate never sent because a `maxTokens` budget in `"stop"` mode had already tripped. `needsReview` flags accepted keys the review heuristics want a human to look at, and never withholds anything. `unfilled`, `malformedRows`, and `duplicateKeys` are populated only by `importWorkbook`, which returns this same shape. Every withheld key keeps its prior lock hash and is retried next run.

Whole-run failures throw an `SdkError`: an unknown format, provider construction (including a missing API key), an unreadable or invalid source file, a corrupt lock file, an invalid `concurrency`, or the concurrency-and-budget conflict above. A per-locale failure never throws; it is isolated on that locale's summary. On a non-dry run the flow also writes `.verbatra-local/run-status.json` (best-effort, read back through `runStatus`).

```ts
const preview = await translate({ config, dryRun: true });
```

### `watch(input): Promise<WatchController>`

Watches the source file and re-runs the translate flow on each debounced change. `input` is `{ config, cwd?, debounceMs?, onRun, cache?, concurrency?, lockAcquireTimeoutMs?, onLockWait?, onProgress? }`; `debounceMs` defaults to 300, and the last five are passed straight through to every run. One run starts immediately at startup, before any change arrives. Runs are serialized, so changes during a run collapse into a single follow-up.

`onRun` receives a `WatchRunResult` per run: `{ status: "succeeded", summary }` or `{ status: "failed", error }` with a secret-free `{ code, message }`, so a failing run is reported and watching continues. `watch` itself throws only at startup: `CONCURRENCY_INVALID` or `CONCURRENCY_BUDGET_CONFLICT` for a `concurrency` no cycle could honor (resolved once, before the watcher exists, rather than failing every cycle), and `SOURCE_UNREADABLE` when the source locale file is absent. Resolves to a `WatchController` whose `stop()` closes the watcher and awaits the in-flight run.

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

Lists the keys a run would touch, without writing anything. `input` is the same `{ config, cwd?, locales? }` shape as `check`. Resolves to a `DiffSummary` whose `locales` lists one `LocaleDiff` each, with the key arrays `missing` (would be added), `changed` (would be re-translated), and `orphaned` (present in the target but absent from the source), plus a per-locale `hasPendingChanges` driven by `missing` and `changed` only, since a default run does not prune. The top-level `hasPendingChanges` is true when any checked locale has some.

```ts
import { diff, loadConfig } from "@verbatra/sdk";

const config = await loadConfig();
const summary = await diff({ config });
```

### `exportWorkbook(input): Promise<ExportWorkbookResult>`

Exports the strings that need translating into a styled Excel workbook for a human translator. `input` is `{ config, cwd?, out?, locales?, includeUnchanged? }`. By default it writes the missing and changed strings for every target locale to `verbatra-translations.xlsx`; `out` overrides the path, `locales` narrows which target locales are exported, and `includeUnchanged: true` also exports already up-to-date strings. No provider is called and no lock file is written. Resolves to an `ExportWorkbookResult` with the absolute `path` written and a per-locale row count.

### `importWorkbook(input): Promise<RunSummary>`

Imports a filled workbook back into the locale files, gating every row through the same integrity gate as `translate` on top of a fresh source-drift check. `input` is `{ config, workbook, cwd?, dryRun? }`. With `dryRun: true` it validates and reports without writing locale files or updating the lock. Resolves to a `RunSummary`, the same shape `translate` returns: a row the translator left blank whose key still needs a translation is reported in that locale's `unfilled` (nothing is written and the prior lock baseline is kept), an unreadable row in `malformedRows`, a repeated key in `duplicateKeys` (the first occurrence wins), and a configured target locale whose sheet is missing from the workbook is reported as that locale's failed summary rather than silently dropped. `unfilled`, `malformedRows`, and `duplicateKeys` do not feed a locale's `status`, so a partly filled sheet still imports the rows it has. A key is cleared by filling its Translation cell with the `[[CLEAR]]` sentinel; an ordinary blank never clears a value.

```ts
import { exportWorkbook, importWorkbook, loadConfig } from "@verbatra/sdk";

const config = await loadConfig();

// Export the strings that need translating to an Excel workbook.
const { path } = await exportWorkbook({ config });

// ...a human fills the Translation column, then import the file back.
const summary = await importWorkbook({ config, workbook: path });
```

See [Manual translation](https://verbatra.kreitz-webdev.de/docs/manual-translation) for the full round-trip and the workbook layout.

### More entry points

Beyond the flows above, the SDK exports the building blocks Verbatra Studio and other tooling sit on, each a one-call read or a locked single-key write:

- `keyIntegrity` reports, per changed key, whether its placeholders still match the source (with the missing and extra tokens on a mismatch) and whether the current target value is still valid ICU.
- `lockState` reports the lock file's existence, version, and per-locale drift; `loadLockFile` reads the lock file itself.
- `runStatus` reads the persisted review-flag and token-usage snapshot the last non-dry `translate` or `watch` run left behind; it never throws, and a missing, corrupt, or unrecognized file simply reports as unavailable.
- `keyValue` reads one key's current source and target values.
- `editEntry` saves a manually edited translation for one key, and `retranslateEntry` re-runs the provider for one key; both run the candidate through the same integrity gate as a full run (a rejection names an `IntegrityGateReason` and writes nothing) and hold the same per-locale write lock.
- `readLocaleFileSnapshot` and `diffLocaleSnapshots` snapshot one locale file as per-key content hashes and compare two snapshots, the primitives behind live-refresh watching.
- `loadConfigWithMeta` is `loadConfig` plus config-source and glossary provenance.

## Errors and results

`SdkError` is the SDK's own structured error type, thrown for whole-run failures such as a missing or invalid config or an unreadable source file. It carries a stable `code` from the exported `SdkErrorCode` union and never contains an API key. It is not the only error a caller can see: `retranslateEntry` propagates the provider's own `ProviderError` when the provider call fails or returns nothing for the key, and a target locale file that exists but is malformed rejects with the adapter's own error.

Per-locale failures do not throw: they are recorded on the `RunSummary` so one failing locale never aborts the others, and that includes a locale whose write lock could not be acquired. A locale's `error.code` is a preserved string from the underlying provider or adapter failure (`"LOCALE_FAILED"` is only the fallback), deliberately wider than `SdkErrorCode`, so do not treat it as a closed set.

## Documentation

- [Documentation site](https://verbatra.kreitz-webdev.de)
- [Project README](https://github.com/mariokreitz/verbatra)
- [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli) for the command-line tool

## License

[MIT](https://github.com/mariokreitz/verbatra/blob/main/LICENSE) (c) Mario Kreitz
