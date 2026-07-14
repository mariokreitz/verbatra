---
"@verbatra/sdk": patch
---

Refreshed the three third-party provider SDKs `@verbatra/sdk` bundles into its published dist: `@anthropic-ai/sdk` (0.105.0 to 0.111.0), `@google/genai` (2.9.0 to 2.11.0), and `openai` (6.44.0 to 6.46.0). This is dependency currency, not a new feature: a changelog and type-diff review of every release in each range found no change to client construction, request or structured-output shape, response JSON extraction, or the thrown error classes `guardProviderCall` classifies into `RATE_LIMITED`, `TIMEOUT`, and `AUTH_FAILED`, so no provider mechanism code changed. `@verbatra/cli` (version-locked with `@verbatra/sdk`) picks up the same bump with no behavior change of its own.
