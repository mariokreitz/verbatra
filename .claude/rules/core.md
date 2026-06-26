---
paths:
  - "packages/core/**"
---

# @verbatra/core rules

This is the pure domain center: model, diffing, hashing, placeholder integrity,
validation. These rules are binding when editing anything under `packages/core`.

- Keep it pure. No I/O, no network, no file system. If a change needs any of those,
  it belongs in a higher package (sdk and above), not here.
- Depend only on zod. Do not add other runtime dependencies.
- Respect the acyclic dependency direction: core may be imported by
  format-adapters, ai-providers, and sdk, but core must never import from them.
  Never import against the arrow; never create a cycle.
- Strict TypeScript throughout: strict, noUncheckedIndexedAccess,
  exactOptionalPropertyTypes, verbatimModuleSyntax, isolatedModules, NodeNext. No
  `any`. Cognitive complexity capped at 15.
- Co-locate Vitest tests as `*.test.ts`. CI enforces 90% coverage on lines,
  functions, statements, and branches.
- Treat translatable strings as untrusted input. Placeholder and ICU integrity
  checks live here and must stay correct.
