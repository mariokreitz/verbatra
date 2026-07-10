---
"@verbatra/ai-providers": minor
"@verbatra/sdk": minor
---

The shared LLM layer (`runLlmTranslation`) no longer discards an entire sub-batch when the model's
response is only partially well-formed. Previously, a response missing, duplicating, or adding a single
key relative to what was requested failed the whole batch with `INVALID_RESPONSE`, so a 50-key sub-batch
that came back with 49 good keys and one bad one withheld and re-paid for all 50 on the next run.

Reconciliation now partitions a response into the well-formed keys (accepted immediately) and the keys
missing or duplicated (neither is safe to guess at). The well-formed remainder is kept, and exactly one
bounded repair round re-requests only the still-missing keys through the same schema-bound boundary.
Placeholder and ICU integrity still runs on every accepted value, including one recovered in the repair
round. A key still missing after the repair round is withheld and reported under the existing
`providerFailures` category (nothing was translated for it), never counted as a placeholder-integrity
mismatch, and the lock baseline advances only for keys actually accepted this run so a withheld key
retries next time.

An unrequested (hallucinated) key is unaffected by this change: it still fails the whole batch
immediately, in the first response or the repair round, exactly as before. This is a reliability
improvement, not a breaking change: `@verbatra/sdk`'s and `@verbatra/cli`'s (version-locked) public
behavior is unchanged except that fewer whole-batch failures are observable when a provider response is
mostly, but not perfectly, well-formed.
