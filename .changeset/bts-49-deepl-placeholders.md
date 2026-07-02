---
"@verbatra/sdk": patch
---

Stop DeepL from burning quota looping on placeholder-bearing strings. DeepL cannot preserve placeholders or ICU tokens, so entries that contain them are now left untranslated (withheld) instead of being sent to DeepL, mangled, and re-attempted on every run. Such entries are reported through a new `PLACEHOLDER_UNSUPPORTED` notice; use an LLM provider to translate placeholder-bearing strings. Placeholder-free strings translate exactly as before. The change lives in the private `@verbatra/ai-providers` package, so the observable behavior change surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked). The new `PLACEHOLDER_UNSUPPORTED` code is an additive member of the provider notice-code union, reachable on the public type surface through the exported `LocaleNotice` type (the per-locale `notices` on a `RunSummary`). The fix is a defect fix so the bump stays patch, but the addition to the public type is called out here so it is deliberate.
