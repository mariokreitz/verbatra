---
"@verbatra/sdk": patch
"@verbatra/studio": patch
---

Withhold degenerate machine translations at the write-path integrity gate. Output that is structurally corrupt (a repetition loop or runaway-length text) but carries no placeholders previously passed the placeholder and ICU checks and was written to disk. Such values are now detected and withheld as an integrity mismatch, so they are retried on the next run and never overwrite an existing good value. Studio surfaces the new rejection reason in its review actions.
