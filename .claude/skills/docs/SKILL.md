---
name: docs
description: Updates the Fumadocs site in apps/docs for a user-facing verbatra change (CLI flag, config key, SDK surface, provider or adapter behavior). Use when the user says "document this", "update the docs", "write the docs page", or a shipped change affects the public surface.
---

# Documentation (docs writer)

Use the `docs-writer` agent in `.claude/agents/docs-writer.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the docs-writer agent with the shipped change.
3. The agent updates the Fumadocs site under `apps/docs` only when the change is
   user-facing, matching the existing structure and tone, with runnable examples
   inside v1 scope (init, translate, watch, export, import; JSON formats; four providers).

Keep docs in English, no emojis, no em dash character (U+2014). Internal-only changes
need no docs; the agent will say so.
