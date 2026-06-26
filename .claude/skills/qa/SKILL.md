---
name: qa
description: Validates a verbatra change against its acceptance criteria, runs or inspects Vitest, checks the 90% coverage thresholds, and verifies placeholder and ICU integrity. Use when the user says "QA this", "run the tests", "check coverage", "validate against the spec", or wants quality assurance after code review.
---

# QA (quality assurance engineer)

Use the `qa-engineer` agent in `.claude/agents/qa-engineer.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the qa-engineer agent with the spec and the implemented change.
3. The agent maps each acceptance criterion to a test or observed behavior, runs or
   inspects Vitest, confirms the 90% thresholds on lines, functions, statements, and
   branches, and verifies placeholder and ICU integrity where translation strings are
   touched (treating strings as untrusted).

The agent reports each criterion as pass or fail with evidence, and any new bug with
steps to reproduce. Failures route back to the developer, then re-run code review and
QA.
