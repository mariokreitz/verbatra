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

- **No-key tier** (`tests/read-only.e2e.test.ts`): packaging smoke, `init` scaffolding,
  and `check` / `diff` / `export` across i18next, YAML, and ARB. These commands make no
  provider call, so the tier runs free and deterministically on every PR.
- **Key-gated tier** (`tests/translate.e2e.test.ts`): real `translate` against a live
  provider. Skips unless `E2E_PROVIDER` (default `deepl`) and its API key are set, so it
  only runs in the nightly job with a secret.

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
  npm test

# add the live tier
E2E_PROVIDER=deepl DEEPL_API_KEY=... npm test
```

Without `VERBATRA_*_TARBALL`, global setup packs the tarballs itself via pnpm.

## Choosing the live provider

`E2E_PROVIDER` is one of `deepl`, `anthropic`, `openai`, `gemini`. DeepL is the default
because it is the cheapest and most deterministic for a smoke translation. The matching
key (`DEEPL_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) must be in
the environment, otherwise the live tier skips.
