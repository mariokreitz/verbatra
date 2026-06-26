---
name: code-review
description: Reviews a verbatra diff for correctness, conventions, complexity, and test quality, returning findings that route back to the developer. Use when the user says "review this code", "review the diff", "review my PR", or wants a code review before QA. Does not change code.
---

# Code review (code reviewer)

Use the `code-reviewer` agent in `.claude/agents/code-reviewer.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the code-reviewer agent with the diff and the spec.
3. The agent returns findings grouped as blocking, should-fix, and nit, each with
   file, location, problem, and the concrete change wanted.

It checks correctness, strict TypeScript with no `any`, cognitive complexity at or
under 15, DRY and KISS and SOLID, layering and dependency direction, zod only at
boundaries, meaningful co-located tests, a present changeset, Conventional Commits,
and that no em dash character (U+2014) or emoji appears in the diff. Blocking and
should-fix findings route back to the developer; re-review after the fix.
