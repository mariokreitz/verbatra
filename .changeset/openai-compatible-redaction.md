---
"@verbatra/studio": patch
---

Add `OPENAI_COMPATIBLE_API_KEY` to the exact-value redaction scrub list, alongside the four hosted providers' key environment variables, so a real key set for the `openai-compatible` provider is redacted from projected config strings and mapped error messages the same way the hosted providers' keys already are.
