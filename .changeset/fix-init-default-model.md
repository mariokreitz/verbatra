---
"@verbatra/cli": patch
---

fix(init): scaffold a real default model per provider

`verbatra init` now writes a real default model (anthropic `claude-sonnet-4-6`, openai
`gpt-5.4-mini`, gemini `gemini-2.5-flash`) instead of the `<your-model>` placeholder, so a
freshly scaffolded `verbatra.config.ts` type-checks immediately under the per-provider model
restriction. Change it to any model the provider supports; the runtime accepts any non-empty
string, so the default going stale is cosmetic.
