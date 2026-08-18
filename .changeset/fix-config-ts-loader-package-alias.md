---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix `verbatra.config.ts` resolving the wrong `@verbatra/sdk` or `@verbatra/cli` when a config
file does `import { defineConfig } from "@verbatra/cli"` (or from `@verbatra/sdk`) and a
different, conflicting install of either package is also reachable from the config file's own
location. `loadConfig` transpiles `.ts` config files through jiti (via
`cosmiconfig-typescript-loader`), which resolves bare specifiers itself, bypassing Node's own
module resolution.

`loadConfig` now passes jiti an alias that points `@verbatra/sdk` and `@verbatra/cli` at the
exact packages installed alongside the SDK build that is actually running, resolved from the
running code's own location rather than from the config file's location. A config file's import
now consistently resolves to the pinned SDK and CLI in effect, even when an unrelated, differently
versioned copy of either package also happens to be installed near the config file. A package that
is not installed anywhere reachable from the running SDK is left unaliased, so the import fails
with the ordinary module-not-found error instead of resolving to the wrong version silently.
