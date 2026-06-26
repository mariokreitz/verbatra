---
name: release
description: Confirms a verbatra change has a correct changeset and bump level, that only intended packages are publishable, and prepares the changelog. Use when the user says "prep the release", "check the changeset", "what bump is this", or wants release readiness checked before shipping.
---

# Release prep (release manager)

Use the `release-manager` agent in `.claude/agents/release-manager.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the release-manager agent with the change.
3. The agent confirms a changeset exists for every publishable src change with the
   correct semver bump and a clear summary, that only `@verbatra/sdk` and
   `@verbatra/cli` are published (config, core, format-adapters, ai-providers, and
   github-action stay internal), that OIDC Trusted Publishing and provenance and the
   exact repository.url are intact, and prepares the changelog entry.

A missing or wrong changeset routes back to the developer.
