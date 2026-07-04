---
"@verbatra/sdk": patch
---

Stop reporting a failed provider call as an integrity mismatch. When a translation sub-batch throws (for example a revoked API key, a rate limit, or a network timeout), the run now reports the affected keys under a new `providerFailures` bucket on the per-locale summary instead of folding them into `integrityMismatches`, which is documented as "translated keys that failed the placeholder-integrity check" and is misleading here since nothing was translated. The `SUB_BATCH_FAILED` notice for that sub-batch now also carries the caught failure's code and message when it is a genuine `ProviderError` (secret-free by construction); any other thrown value still falls back to a static, generic message so nothing unvetted can leak through.

This adds `providerFailures` as an additive member of the exported `LocaleSummary` type on `@verbatra/sdk`. The behavior fixed is a defect, so the bump stays patch, but the addition to the public type is called out here so it is deliberate. `@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
