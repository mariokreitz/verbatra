---
"@verbatra/studio": patch
---

Rewrite the WebMCP agent tool descriptions so an agent can choose between them. Every tool now states what it does, when to use it, when not to use it, what each parameter means, and the caveats that change a decision. The two spend-gated tools say plainly that they spend provider budget, that they are not idempotent, and that they cannot be undone, and the retranslate tool says that the provider is billed before the integrity check runs, so a rejected result still costs money. Tool names, schemas, annotations, gating, and behavior are unchanged.
