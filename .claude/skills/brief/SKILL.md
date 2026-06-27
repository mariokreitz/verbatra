---
name: brief
description: Writes or refines a verbatra spec with acceptance criteria for a feature, bug, chore, or docs change. Use when the user says "write a spec", "draft a brief", "turn this into a ticket", "define acceptance criteria", or wants the product owner to capture and scope a request before any code is written.
---

# Write a spec (product owner)

Use the `product-owner` agent in `.claude/agents/product-owner.md` to
turn the user's request into a written spec.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the product-owner agent with the request and any linked tracker item or
   issue.
3. The agent writes `.verbatra/specs/<slug>.md` with problem statement, scope
   (in and out), numbered acceptance criteria, affected packages, and a v1 scope
   check.

Keep the spec in English, no emojis, no em dash character (U+2014). This is the entry
point of the full workflow; to carry the spec all the way to sign-off, use the
`feature` skill instead.
