<p align="center">
  <img src="https://raw.githubusercontent.com/mariokreitz/verbatra/main/.github/assets/verbatra-mark.png" alt="verbatra logo, a glowing V mark on a dark square" width="96" height="96" />
</p>

<h1 align="center">@verbatra/studio</h1>

<p align="center">
  Verbatra Studio: a local web dashboard over a verbatra project, with live refresh and built-in local editing, served through the <code>verbatra studio</code> command.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@verbatra/studio"><img src="https://img.shields.io/npm/v/@verbatra/studio?label=%40verbatra%2Fstudio" alt="@verbatra/studio npm version" /></a>
  <a href="https://github.com/mariokreitz/verbatra/actions/workflows/ci.yml"><img src="https://github.com/mariokreitz/verbatra/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://codecov.io/gh/mariokreitz/verbatra"><img src="https://codecov.io/gh/mariokreitz/verbatra/graph/badge.svg" alt="Coverage" /></a>
  <a href="https://github.com/mariokreitz/verbatra/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

## Description

`@verbatra/studio` is the dashboard behind the `verbatra studio` command: a prebuilt single-page app served by a small loopback HTTP server, showing your project's translation state live. You install it as a dev dependency next to [`@verbatra/cli`](https://github.com/mariokreitz/verbatra/tree/main/packages/cli); the CLI loads it on demand, so its absence never breaks the rest of the CLI.

## Requirements

Node.js `>=22.14.0`.

## Installation

```bash
pnpm add -D @verbatra/cli @verbatra/studio
# npm
npm install -D @verbatra/cli @verbatra/studio
# yarn
yarn add -D @verbatra/cli @verbatra/studio
```

## Quick start

```bash
verbatra studio
# Verbatra Studio running at http://127.0.0.1:5849/?token=...
```

Open the printed URL (the token is required). Studio has four pages:

- **Translations**: per-locale status, the diff, and lock drift, down to a per-key detail view with the source value and every target's current translation.
- **Review**: the needs-review queue of flagged translations, with in-place editing.
- **Activity**: a live feed of locale-file changes, plus the last run's token usage and budget.
- **Settings**: the resolved config, the glossary, and the session's capabilities.

Every page refreshes live over a server-sent event stream as your locale files change; only a `verbatra.config.ts` change needs a manual restart.

## Editing and provider spend

Local editing is always on: an edit from the Review queue runs through the same placeholder and ICU integrity checks as a translate run, then writes the locale file and the lock. Actions that spend provider budget (retranslating a key, translating pending changes) exist only when Studio is started with `--allow-spend` or with `VERBATRA_STUDIO_ALLOW_SPEND` set; without that flag, Studio never calls a provider.

## Security model

- The server binds to `127.0.0.1` only; it is never reachable from the network.
- Every request is gated behind a random per-session token, minted at startup.
- Provider calls require the explicit `--allow-spend` opt-in.
- API keys are read only from environment variables, never from the config, and never reach the browser.

See the [Verbatra Studio docs](https://verbatra.kreitz-webdev.de/docs/cli/studio) for the full command reference.

## Programmatic use

The package's entry point is `startStudioServer`, which binds the server to `127.0.0.1` and serves the SPA from the built assets (alongside it: the `DEFAULT_STUDIO_PORT` constant and the structured `StudioServerStartError`). The CLI's `studio` command is the intended consumer; most projects never call it directly.

## Development

Notes for working on this package inside the [verbatra monorepo](https://github.com/mariokreitz/verbatra):

- `src/index.ts` exports `startStudioServer`, which serves the SPA from the built assets next to the compiled module (or from an injected override).
- `src/server/` is the server implementation, covered by tests.
- `src/app/` is the React single-page app, built by Vite into `dist/app`. It is not covered by tests; measured client logic that is not React rendering lives in `src/client/`. Changes to `src/app/api.ts` in particular wire real browser globals (`fetch`, `EventSource`) into the covered client modules; smoke-test them in a real browser after touching that file, since a detached reference to a browser global can typecheck and pass every unit test while still throwing at runtime (a bare `const f = fetch` loses `fetch`'s required `Window` receiver and throws "Illegal invocation" the moment it is called).
- `src/dev/` is a local-only development entry point. It is never imported by `src/index.ts`, is never bundled by the build, and is never published.

### Build

`pnpm build` runs `tsup && vite build`, in that order: `tsup` compiles and cleans `dist/`, then Vite writes the SPA into `dist/app`. Running the two steps in the other order would delete the SPA output.

### Dev flow

The dev flow is same-origin: there is no dev proxy and no hot module reloading. Two processes run side by side against the built output, so the local dashboard is served the same way it is in production.

In one terminal, keep the SPA rebuilding on every change:

```sh
pnpm dev:app
```

In a second terminal, run the real server against those built assets:

```sh
pnpm dev:server
```

`pnpm dev:app` runs an unminified `vite build --watch`, so `dist/app` always holds a fresh, readable build. Wait for its first build pass to finish before opening the printed URL; opening it earlier serves a `dist/app` that does not exist yet or is stale.

The dev server entry point (`src/dev/server.ts`) passes an explicit assets-root override pointing at `dist/app` and a fixed token read from the `VERBATRA_STUDIO_DEV_TOKEN` environment variable (with a built-in fallback), because the default assets-root resolution only makes sense relative to the built `dist/index.js`, not to the TypeScript source the dev entry runs from.

## License

[MIT](https://github.com/mariokreitz/verbatra/blob/main/LICENSE) (c) Mario Kreitz
