---
"@verbatra/sdk": patch
---

Accept reordered placeholders that carry the same multiset instead of withholding them as integrity failures. Translations that legitimately reorder placeholders for a target language (for example German, Japanese, or Arabic word order) are now written on every path (LLM and DeepL runs, plural-form generation, and workbook import) rather than being rejected and re-attempted on each run.
