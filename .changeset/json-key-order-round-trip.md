---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Preserve document key order exactly on round-trip for the JSON-family, YAML, and ARB adapters. Integer-like keys such as "2", "10", or "404" are no longer hoisted to the front and re-sorted on read or write, so files keyed by numeric ids, HTTP status codes, or years keep their own key order, and new keys added by a translate run now append after the target's existing keys in source-document order instead of alphabetically. As part of the YAML conformance, a document using a map or sequence as a mapping key is now rejected with a structured INVALID_STRUCTURE error instead of silently collapsing to "[object Object]".
