# @verbatra/e2e

End-to-end tests that install the published `@verbatra/cli` and `@verbatra/sdk`
tarballs into a throwaway project and drive the real `verbatra` binary, the way a
user would. This catches packaging, bundling, and bin regressions that the per-package
unit tests cannot see.

This directory is deliberately outside the pnpm workspace so the consumer install
resolves the real tarballs instead of workspace symlinks.

## How it works

`src/global-setup.ts` packs `@verbatra/sdk` and `@verbatra/cli` once (or reuses the
paths in `VERBATRA_SDK_TARBALL` / `VERBATRA_CLI_TARBALL`). Each test builds a temp
project, `npm install`s both tarballs, and runs the binary via `src/harness.ts`.

## Tiers

The suite is split by trust boundary so a provider secret never reaches code that a pull
request can modify.

- **No-key tier** (`tests/read-only.e2e.test.ts`, run with `npm run test:nokey`): packaging
  smoke, `init` scaffolding, `check` / `diff` / `export` across i18next, YAML, and ARB,
  `translate --dry-run`, a full `export` then `import` round-trip (a workbook filled in code
  the way a translator would), structured exit-2 boundary errors (missing config, invalid
  config values, an invalid `--debounce`, an unreadable `.env`), and the `watch` SIGINT
  contract: the watcher starts without a provider key, and a single interrupt stops it cleanly
  with exit 0 after at least one NDJSON record. It makes no provider call, so it is
  deterministic and free, and gates every pull request and push to `main` as the `e2e` job in
  `.github/workflows/ci.yml`.
- **Live tier** (`tests/translate.e2e.test.ts`, `tests/watch.e2e.test.ts`, run with `npm test`):
  real `translate` and `watch` against a live provider. `translate` fills a missing key and
  leaves the project in sync; `watch` translates on startup, again on a source change, and
  stops on interrupt. It needs `E2E_PROVIDER` (default
  `gemini`) and the matching API key, and skips otherwise. `.github/workflows/e2e-live.yml`
  runs it on a nightly schedule, on push to `main`, and on manual dispatch only, never on a
  pull request, with the key scoped to the `live-e2e` GitHub Environment. Its status is not a
  required check, so a provider outage never blocks a merge.

## Running locally

```sh
# assumes `pnpm install` has been run at the repo root
cd e2e
npm install

# no-key tier (no secrets needed)
npm run test:nokey

# full suite, adding the live tier
E2E_PROVIDER=gemini GEMINI_API_KEY=... npm test
```

Without `VERBATRA_SDK_TARBALL` / `VERBATRA_CLI_TARBALL`, global setup builds `@verbatra/sdk`,
`@verbatra/cli`, and their workspace dependencies, then packs the tarballs itself via pnpm, so a
stale local `dist/` is never packed by accident. To reuse tarballs you packed yourself (the CI
path), set both variables; setting only one fails setup. The variables must hold concrete paths
(the harness does not expand globs), so resolve them with `$(ls ...)`:

```sh
# from the repo root
pnpm build
mkdir -p /tmp/packs
pnpm --filter @verbatra/sdk pack --pack-destination /tmp/packs
pnpm --filter @verbatra/cli pack --pack-destination /tmp/packs

cd e2e
VERBATRA_SDK_TARBALL=$(ls /tmp/packs/verbatra-sdk-*.tgz) \
VERBATRA_CLI_TARBALL=$(ls /tmp/packs/verbatra-cli-*.tgz) \
  npm run test:nokey
```

## Choosing the live provider

`E2E_PROVIDER` is one of `gemini`, `anthropic`, `openai`, `deepl`. Gemini is the default
because it has a free API tier, which keeps the nightly smoke translation at no cost. The
matching key (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPL_API_KEY`)
must be in the environment, otherwise the live tier skips.
