---
name: ci-check
description: Verifies the verbatra CI and DevOps posture: Turborepo pipeline coverage, a committed and consistent lockfile, GitHub Actions pinned to SHAs, least-privilege token, and intact OIDC Trusted Publishing. Use when the user says "check CI", "verify the pipeline", "is the workflow secure", or wants the DevOps gate before sign-off.
---

# CI and DevOps check (devops engineer)

Use the `devops-engineer` agent in `.claude/agents/devops-engineer.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the devops-engineer agent with the change and the CI config.
3. The agent verifies the Turborepo pipeline covers the change, Node >=22.14.0 and
   pnpm@11.6.0 are honored, the lockfile is committed and consistent, every GitHub
   Action is pinned to a commit SHA, the GITHUB_TOKEN is least-privilege, no secrets
   live in workflow files, OIDC Trusted Publishing and provenance are intact, and the
   90% coverage gates still run.

A security-weakening misconfiguration is blocking and routes back to the developer.
Never loosen security to make a check pass.
