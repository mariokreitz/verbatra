---
name: architecture-review
description: Reviews or designs the approach for a verbatra change against the monorepo architecture rules, and writes an ADR when the change is significant. Use when the user asks "is this the right design", "where should this live", "can package X import Y", "how do I add a provider or format", or wants an architecture decision record.
---

# Architecture review (software architect)

Use the `software-architect` agent in
`.claude/agents/software-architect.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the architect agent with the spec or design question and the relevant
   code.
3. The agent validates against SDK-first layering, the acyclic dependency direction,
   the provider Strategy plus Factory plus Registry layer, and the
   `createJsonFileAdapter` factory, then returns a concise design note. For a
   significant change it writes an ADR under `.verbatra-team/adr/`.

Reject any approach that imports against the dependency arrow, duplicates the
provider or adapter machinery, or pushes I/O or key handling into `@verbatra/core`.
