# @verbatra/core

## 0.1.0

### Minor Changes

- bde1174: Add 'ngx-translate-json' to SupportedFormat, so the format-adapters package can declare an
  ngx-translate adapter. Additive only; existing format values are unchanged.
- 7aeaca7: Add the pure domain core: format-neutral model (TranslationEntry, LocaleResource,
  SupportedFormat) with zod schemas, deterministic per-entry content hash, resource diffing
  (missing/changed/orphaned/unchanged), placeholder-integrity comparison, and validation
  reporting. No I/O, no format- or provider-specific knowledge.
