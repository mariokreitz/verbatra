---
"@verbatra/sdk": patch
---

Harden workbook import against a maliciously crafted archive. The importer behind `verbatra import` (and the SDK `importWorkbook`) now streams each archive entry through a memory-bounded reader and stops as soon as the decompressed size passes the configured limit, so a high-ratio compressed workbook is rejected with a clear error instead of exhausting memory. Previously such a workbook could be fully inflated before the size check ran, which could exhaust process memory when importing an untrusted file.
