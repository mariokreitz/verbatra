---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add a content-addressed translation-memory (TM) cache so a translation whose source content is unchanged is reused for free instead of being re-sent to the provider. A translation is reused even when its key was renamed, and identical source text shared across two keys is paid for once. The cache lives in a local, gitignored, regenerable `verbatra.cache.json` sibling to the lock file (scaffolded into `.gitignore` by `init`); it is never a field on the lock file and never committed.

Each entry is keyed by `(sourceContentHash, targetLocale, fingerprint)`, nested by fingerprint under a top-level `version`. The fingerprint is a stable hash over the provider id, model, tone, and sorted glossary; format is deliberately excluded because every reused value is re-checked by the placeholder/ICU integrity gate against the current source before it is applied, so a hit that no longer matches the target format is discarded and its key falls through to the provider. Reused hits apply silently (never flagged for review). A changed fingerprint (for example a different tone) never serves a stale value.

The cache is resilient by design: a missing, corrupt, oversized, or unrecognized-version file degrades to an empty cache and never fails a run (unlike the fatal lock-file). It is read once as an immutable snapshot at run start and written once at the end (best-effort, dry-run-skipped), which keeps it safe under locale concurrency. Values accepted by `importWorkbook`, `editEntry`, and `retranslateEntry` are also fed into the cache so a later run reuses them.

The cache is on by default. `translate()` and `watch()` accept an optional `cache` input (surfaced on the CLI as `--no-cache`) that bypasses both the read and the write for a run, making it behave exactly as if no cache existed and leaving any existing cache file untouched. To rebuild or discard the cache, delete `verbatra.cache.json`; it is regenerated naturally on the next run. `LocaleSummary` gains a `cacheHits` bucket (rendered as "from cache" in the CLI) reporting the keys served from cache as avoided provider usage.

Known limitation: generated plural forms are out of v1 TM scope. A synthesized CLDR plural form is neither served from nor written to the cache; only main-path diff candidates participate. Also, identical source content shared by two keys within a single run is satisfied at request granularity (one provider request covers the shared string), per the snapshot-only design; within-run miss deduplication is out of scope.
