---
"@verbatra/core": minor
---

Add the pure domain core: format-neutral model (TranslationEntry, LocaleResource,
SupportedFormat) with zod schemas, deterministic per-entry content hash, resource diffing
(missing/changed/orphaned/unchanged), placeholder-integrity comparison, and validation
reporting. No I/O, no format- or provider-specific knowledge.
