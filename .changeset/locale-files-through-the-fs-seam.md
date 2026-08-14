---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Supplying `deps.fs` now redirects the locale files too, so an SDK run can be fully in memory. The
format adapters previously read and wrote translations through `node:fs` directly, which meant a
custom `SdkFs` covered the run-status file, the lock-file, the glossary and workbook I/O, but never
the project's actual payload. Adapters now take a file-system port at construction time, and the SDK
builds that port from `deps.fs`.

Nothing changes for a caller that does not pass `deps.fs`: adapters keep their node-backed
implementation, including the fsync-and-rename atomic write. One limitation remains, and it is now
documented on `SdkFs`: adapters supplied through `deps.adapterRegistry` were constructed by the
caller, so `deps.fs` cannot reach them. Passing both means you own that wiring.
