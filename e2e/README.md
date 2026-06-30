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
  smoke, the `watch` subcommand help, `init` scaffolding, `check` / `diff` / `export` across
  i18next, YAML, and ARB, `translate --dry-run`, and a full `export` then `import` round-trip
  (a workbook filled in code the way a translator would). It makes no provider call, so it is
  deterministic and free, and gates every pull request and push via `.github/workflows/e2e.yml`.
- **Live tier** (`tests/translate.e2e.test.ts`, `tests/watch.e2e.test.ts`, run with `npm test`):
  real `translate` and `watch` against a live provider. It needs `E2E_PROVIDER` (default
  `gemini`) and the matching API key, and skips otherwise. `.github/workflows/e2e-live.yml`
  runs it on a nightly schedule, on push to `main`, and on manual dispatch only, never on a
  pull request, with the key scoped to the `live-e2e` GitHub Environment. Its status is not a
  required check, so a provider outage never blocks a merge.

## Running locally

```sh
# from the repo root, build and pack first so the tarballs exist
pnpm build
pnpm --filter @verbatra/sdk pack --pack-destination /tmp/packs
pnpm --filter @verbatra/cli pack --pack-destination /tmp/packs

cd e2e
npm install
# no-key tier (no secrets needed)
VERBATRA_SDK_TARBALL=/tmp/packs/verbatra-sdk-*.tgz \
VERBATRA_CLI_TARBALL=/tmp/packs/verbatra-cli-*.tgz \
  npm run test:nokey

# full suite, adding the live tier
E2E_PROVIDER=gemini GEMINI_API_KEY=... npm test
```

Without `VERBATRA_*_TARBALL`, global setup packs the tarballs itself via pnpm.

## Choosing the live provider

`E2E_PROVIDER` is one of `gemini`, `anthropic`, `openai`, `deepl`. Gemini is the default
because it has a free API tier, which keeps the nightly smoke translation at no cost. The
matching key (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPL_API_KEY`)
must be in the environment, otherwise the live tier skips.
