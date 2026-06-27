---
"@verbatra/ai-providers": patch
---

Harden provider error redaction. Extend `redact()` key-shape coverage to all four v1 providers: the OpenAI and Anthropic `sk-` prefixes (word-boundary anchored so ordinary words like "risk-" pass through), Google Gemini `AIza` keys, and DeepL hex UUID keys with the optional `:fx` free-tier suffix. Wire `redact()` into the `ProviderError` constructor as a defense-in-depth backstop that pattern-scrubs every message.

Provider errors stay secret-free by construction, which remains the primary control: `guardProviderCall` discards any caught SDK error and throws a static `ProviderError`, and `env.ts` names a missing variable but never its value. On the live paths every message is a compile-time constant, so the backstop scrub is a no-op and there is no behavior change. Every pattern is linear and ReDoS-safe.

This is internal hardening in a private, bundled package. There is no public `@verbatra/sdk` or `@verbatra/cli` API change and no observable behavior change on any live path, so the published packages are intentionally not versioned here.
