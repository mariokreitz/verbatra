---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Document the published SDK API. Every declaration that ships in the package's type declarations now
carries JSDoc: entry points describe their behavior and the error codes they throw, input, result,
and event shapes document each property, and the config, provider, and adapter types inlined from
the workspace packages are documented too. Editors show these on hover. No runtime behavior, output,
or type signature changes.
