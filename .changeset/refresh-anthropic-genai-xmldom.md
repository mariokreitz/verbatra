---
"@verbatra/ai-providers": patch
"@verbatra/format-adapters": patch
"@verbatra/sdk": patch
---

Refresh the bundled Anthropic (`@anthropic-ai/sdk`, 0.116.0 to 0.117.1), Gemini (`@google/genai`,
2.16.0 to 2.17.1), and `@xmldom/xmldom` (0.9.10 to 0.9.11) packages pinned in the `bundled` pnpm
catalog. `@verbatra/sdk` bundles `@verbatra/ai-providers` and `@verbatra/format-adapters` into its
published dist, so these exact versions ship to every consumer of `@verbatra/sdk` and
`@verbatra/cli`.

All three are routine patch and minor upstream releases with no consumer-facing breaking change.
`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior
is unchanged.
