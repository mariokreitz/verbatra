---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Deduplicate the tolerant target-locale read into a single shared helper. The export, import, and per-locale translate flows now delegate to the same implementation as diff and check, so the empty-resource shape and the file-existence check can no longer drift apart. No behavior change.
