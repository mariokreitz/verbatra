---
name: implement
description: Implements a ready verbatra spec in the local repo with strict TypeScript, co-located Vitest tests, and a changeset. Use when the user says "implement this", "build the feature", "fix the bug", "write the code", or hands a ready spec to a developer. Also handles the clarify loop before coding.
---

# Implement a change (developer)

Use the `developer` agent in `.claude/agents/developer.md`.

1. Read `CLAUDE.md` at the repository root.
2. If the spec is not yet clear, run the clarify loop first: the developer lists open
   questions, the product owner answers, repeat until zero questions remain (cap at
   three iterations, then raise a blocker).
3. Dispatch the developer agent to implement in the local mounted repository: strict
   TypeScript, no `any`, cognitive complexity at or under 15, reuse of the provider
   registry and adapter factory, zod at boundaries only, co-located `*.test.ts`
   tests, and a changeset for any publishable src change.

The GitHub connector is read-only; write code locally and never push. When done,
summarize the diff, the tests, and the changeset.
