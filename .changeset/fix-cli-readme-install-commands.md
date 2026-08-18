---
"@verbatra/cli": patch
---

Fix the README install and quick-start commands. The `verbatra studio` setup snippet now installs `@verbatra/cli` alongside `@verbatra/studio`, and the "try before installing" example now uses the working `npx @verbatra/cli --help` (or `pnpm dlx @verbatra/cli --help`) instead of the broken `npx verbatra` cold-run, which fails with a registry 404 for an unrelated package.
