---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix config discovery so it actually searches upward from the working directory, as the README,
SDK README, and docs site already documented. `loadConfig` previously left cosmiconfig's
`searchStrategy` unset, which defaults to `none` (current directory only), so running verbatra
from a nested monorepo package directory raised `CONFIG_NOT_FOUND` instead of finding the config
at the repository root.

The search now walks upward and stops at the nearest ancestor directory containing a `.git` entry
(or the user's home directory if none is found), so it finds a monorepo-root config without
wandering into an unrelated project above the repository.
