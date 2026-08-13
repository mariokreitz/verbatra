---
"@verbatra/studio": patch
"@verbatra/cli": patch
---

Document the published Studio API and strip internal prose comments from both packages. Every
declaration that ships in Studio's type declarations now carries JSDoc: `startStudioServer`
describes its startup ordering, the error codes it throws, and a runnable example, and the server
option, dependency, watcher, and error shapes document each property. Editors show these on hover.
The CLI's published declarations are a re-export of the SDK's config helpers and are documented
there. No runtime behavior, output, or type signature changes.
