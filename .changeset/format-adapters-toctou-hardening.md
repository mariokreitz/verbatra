---
"@verbatra/format-adapters": patch
---

Harden JSON and ngx-translate file reads against a stat-then-read TOCTOU by reading through a single fstat'd file handle with a bounded read, so swapping the path for a larger file cannot bypass the size cap. Also wrap ICU validity computation so every read failure surfaces as a structured `AdapterError`.
