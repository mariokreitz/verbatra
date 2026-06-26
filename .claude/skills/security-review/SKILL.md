---
name: security-review
description: Audits a verbatra change for API key handling, structured errors, the prompt-injection boundary, and supply-chain and publishing security. Use when the user says "security review", "check for leaks", "audit key handling", "is this safe to publish", or wants the final security gate before release.
---

# Security review (security reviewer)

Use the `security-reviewer` agent in
`.claude/agents/security-reviewer.md`.

1. Read `CLAUDE.md` at the repository root.
2. Dispatch the security-reviewer agent with the change and the relevant config and
   CI files.
3. The agent audits: API keys read only from env via the env readers, never logged or
   committed, routed through `redact()`; structured ProviderError usage; the
   prompt-injection boundary (compile-time system rules, untrusted input only in the
   user-turn payload, schema-bound validated output, placeholder and ICU integrity);
   and supply-chain security (OIDC Trusted Publishing, provenance, exact
   repository.url, least-privilege GITHUB_TOKEN, action pinning to SHA, committed
   lockfile).

Findings are ranked critical, high, medium, low. Critical and high route back (code
issues to the developer, scope issues to the product owner). Never quote a real
secret; redact it.
