---
"@verbatra/cli": minor
---

Add a `verbatra studio` command that starts Verbatra Studio, a local, read-only translation dashboard served from `@verbatra/studio`. The command loads the project config before anything else, prints a one-time tokenized loopback URL once the server is listening, and exits cleanly on Ctrl-C (a second interrupt force-stops it). It reaches `@verbatra/studio` only through a dynamic import, so it fails with a clear install hint instead of a crash when that package is not present. `@verbatra/sdk` is version-locked with `@verbatra/cli` and picks up the same bump; its own behavior is unchanged.
