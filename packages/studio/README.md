# @verbatra/studio

Local Verbatra Studio dashboard: a read-only web view over a verbatra project, served from a
prebuilt single-page app by a small loopback HTTP server.

This package is published to npm as a prerelease. It has not had a stable release yet, so its own `latest` dist-tag already carries the current prerelease build; no `@next` needed to install it.

## Layout

- `src/index.ts` exports `startStudioServer`, which binds a server to `127.0.0.1` and serves the SPA
  from the built assets next to the compiled module (or from an injected override).
- `src/server/` is the server implementation, covered by tests.
- `src/app/` is the React single-page app, built by Vite into `dist/app`. It is not covered by
  tests; measured client logic that is not React rendering lives in `src/client/`. Changes to
  `src/app/api.ts` in particular wire real browser globals (`fetch`, `EventSource`) into the
  covered client modules; smoke-test them in a real browser after touching that file, since a
  detached reference to a browser global can typecheck and pass every unit test while still
  throwing at runtime (a bare `const f = fetch` loses `fetch`'s required `Window` receiver and
  throws "Illegal invocation" the moment it is called).
- `src/dev/` is a local-only development entry point. It is never imported by `src/index.ts`, is
  never bundled by the build, and is never published.

## Build

`pnpm build` runs `tsup && vite build`, in that order: `tsup` compiles and cleans `dist/`, then
Vite writes the SPA into `dist/app`. Running the two steps in the other order would delete the
SPA output.

## Development

The dev flow is same-origin: there is no dev proxy and no hot module reloading. Instead, two
processes run side by side against the built output, so the local dashboard is served the same
way it is in production.

In one terminal, keep the SPA rebuilding on every change:

```sh
pnpm dev:app
```

In a second terminal, run the real server against those built assets:

```sh
pnpm dev:server
```

`pnpm dev:app` runs an unminified `vite build --watch`, so `dist/app` always holds a fresh,
readable build. Wait for its first build pass to finish before opening the printed URL; opening
it earlier serves a `dist/app` that does not exist yet or is stale.

The dev server entry point (`src/dev/server.ts`) passes an explicit assets-root override pointing
at `dist/app` and a fixed token read from the `VERBATRA_STUDIO_DEV_TOKEN` environment variable (with a
built-in fallback), because the default assets-root resolution only makes sense relative to the
built `dist/index.js`, not to the TypeScript source the dev entry runs from.
