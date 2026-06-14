---
"@verbatra/ai-providers": minor
---

Add the OpenAI provider and extract a shared internal LLM scaffolding layer. The shared layer owns
the provider-agnostic flow (structured data payload, canonical per-key result schema as a single
source of truth, response validation and key-set reconciliation, post-translation integrity,
secret-free errors, key-from-env) behind one mechanism extension point. Anthropic is reimplemented on
the shared layer (forced tool-use as its mechanism, tool schema derived from the canonical schema),
behavior-preserving. OpenAI uses Chat Completions Structured Outputs with a json_schema derived from
the same canonical schema, re-validated with zod on our side, refusals surfaced as a distinct
PROVIDER_REFUSED error, key read only from OPENAI_API_KEY, and SDK request logging suppressed.
