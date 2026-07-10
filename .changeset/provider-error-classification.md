---
"@verbatra/sdk": minor
---

Providers now classify a failed translation call by HTTP status code or SDK error class instead of collapsing every failure into one opaque error: a 429 or an equivalent rate-limit error class surfaces as `RATE_LIMITED`, a network or request timeout as `TIMEOUT`, and a 401 or 403 as `AUTH_FAILED`, with the prior generic code kept as the fallback for anything unclassified. Classification never inspects error message text, so nothing provider-specific or key-shaped can leak through it. A caller-initiated cancellation (via `AbortSignal`) is now re-thrown as an abort instead of being wrapped as a provider error, so it can be told apart from a real failure; abort detection correlates the caught error's own identity with the signal instead of trusting the signal's `aborted` flag alone, so an unrelated failure that merely coincides with the signal being aborted is still classified and redacted, never passed through raw.

The Gemini provider now retries a transient rate limit or server error with backoff before giving up, closing a gap where a single transient failure could kill an entire translation sub-batch (the other three v1 providers already retry through their own SDKs).

A translation request can now carry an optional cancellation signal, threaded down into each provider's underlying call where the provider's SDK supports it. This is additive: `@verbatra/sdk`'s own APIs are unchanged in behavior, and `@verbatra/cli` (version-locked with `@verbatra/sdk`) picks up the same bump with no behavior change of its own.
