---
name: docs
description: Updates the Fumadocs site in apps/docs for a user-facing verbatra change (CLI flag, config key, SDK surface, provider or adapter behavior). Use when the user says "document this", "update the docs", "write the docs page", or a shipped change affects the public surface.
---

# Documentation (docs writer)

Use the `docs-writer` agent in `.claude/agents/docs-writer.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the docs-writer agent with the shipped change.
3. The agent updates the Fumadocs site under `apps/docs` only when the change is
   user-facing, matching the existing structure and tone, with runnable examples of the
   shipped surface. It reads that surface from the code, never from a list in a guidance
   file: the `.command(...)` registrations in `packages/cli/src/run.ts`,
   `createDefaultRegistry` in `@verbatra/format-adapters`, and the provider factory table
   in `packages/sdk/src/config/provider-config.ts`.

Keep docs in English, no emojis, no em dash character (U+2014). Internal-only changes
need no docs; the agent will say so.
