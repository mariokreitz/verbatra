---
"@verbatra/sdk": minor
---

Add @verbatra/sdk, the central orchestration API and the first SDK slice: the one-shot
end-to-end translate flow that composes core, format-adapters, and ai-providers
(config -> read -> diff -> translate -> write) with verbatra.lock.json as the
change-detection baseline.

The SDK adds no format, provider, or hashing logic of its own: it loads and zod-validates
the config (cosmiconfig + cosmiconfig-typescript-loader, supporting a code-defined
verbatra.config.ts via defineConfig and file-based configs, first-found-wins),
selects an adapter by explicit format, constructs the configured provider (key read from
env by the provider, never by the SDK), injects the selected adapter's own placeholder
extractor into every translate request, routes the glossary term-map to the provider and
surfaces provider notices, and reuses core's diffResources and contentHash.

Per target locale it reads source + target, diffs against the lock-file baseline,
translates only missing/changed keys (skipping invalid-ICU source), enforces per-key
integrity (a failed key is withheld from the file and not lock-updated, so it retries),
writes back preserving structure/order, and updates the lock-file. Locales are isolated:
one locale's failure does not roll back others and the run continues. Dry-run reads + diffs
+ reports without constructing or calling the provider and without writing any file or the
lock-file. Watch mode is intentionally deferred to a later slice.
