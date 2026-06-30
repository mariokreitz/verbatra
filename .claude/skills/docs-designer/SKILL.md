---
name: docs-designer
description: Designs the visual and UX layer of the official verbatra docs site in apps/docs (landing page, Fumadocs theme and chrome, React components, and the design system in app/global.css). Use when the user says "design the docs", "redesign the landing", "improve the look and feel", "style this component", "make it responsive", or wants design system work on the docs site. Does not write doc prose (use the docs skill for that) and never touches the SDK or CLI.
---

# Docs design (docs designer)

Use the `docs-designer` agent in `.claude/agents/docs-designer.md`.

1. Read `CLAUDE.md` at the repository root and `.claude/rules/docs.md`.
2. Dispatch the docs-designer agent with the design request.
3. The agent works only on the visual and UX layer of `apps/docs`: the landing page,
   the Fumadocs theme and navigation chrome, the components under `components/`, and the
   design system tokens in `app/global.css`. It works through the existing tokens and
   components, stays on the verbatra brand (deep `--v-purple`, `--v-glow` accent,
   purple-tinted shadows), keeps the single dark theme, and designs responsively and
   accessibly with `prefers-reduced-motion` respected.

Boundaries: this skill is the visual counterpart to the `docs` skill. It does not write
or edit documentation prose, MDX content, or `messages/*.json` UI strings (that is the
docs-writer via the `docs` skill), and it never changes the SDK, CLI, or any package
outside `apps/docs`. Keep everything English, no emojis, no em dash character (U+2014).

After edits to `app`, `lib`, or `components`, the agent runs `pnpm typecheck` in
`apps/docs` (or `pnpm turbo run typecheck --filter=@verbatra/docs`).
