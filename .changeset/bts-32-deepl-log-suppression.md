---
"@verbatra/ai-providers": patch
---

Make DeepL log suppression robust to a loglevel dependency split. The deepl-node SDK logs request and response content at debug through a loglevel logger named "deepl"; suppression now silences both our own loglevel import and the loglevel instance deepl-node itself resolves, so untranslated source content stays suppressed even if pnpm stops deduplicating loglevel to a single instance. deepl-node and loglevel are now grouped in the Dependabot update policy so they bump together. By-construction key handling is unchanged: the auth key is never passed to a log call. No public API or behavior change; @verbatra/sdk and @verbatra/cli are intentionally not versioned.
