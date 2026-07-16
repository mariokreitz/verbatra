---
"@verbatra/studio": patch
---

Give the server's per-method throttle its own METHOD_RATE_LIMITED error code so the client no longer blames the translation provider for a purely local rate limit. The 429 answered by the RPC gate previously reused the provider code RATE_LIMITED, and the client copy table rendered it as "The translation provider is rate-limiting requests", sending users to investigate API keys and provider status for a transient local throttle. The transport 429 now carries METHOD_RATE_LIMITED and renders as "Studio is limiting how often this action can run. Wait a moment and try again." A genuine provider RATE_LIMITED, forwarded from a spend-path handler, keeps its provider-worded copy. Older clients that do not know the new code fall back to the server's own accurate message.
