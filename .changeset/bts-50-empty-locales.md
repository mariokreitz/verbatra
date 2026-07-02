---
"@verbatra/sdk": patch
---

Fix a false green in the CI drift gates: `check`, `diff`, and `export` now reject an empty or unknown `--locales` value instead of silently exiting 0.

A `--locales` value that normalizes to an empty list (for example `""` or `","`) is now a usage error that exits 2, and a requested locale that is not among the configured target locales is rejected as a whole-run error naming the unknown locale(s) rather than being silently dropped.

This adds `UNKNOWN_LOCALE` as an additive member of the exported `SdkErrorCode` union on `@verbatra/sdk`. The behavior fixed is a defect, so the bump stays patch, but the new code is called out here so the addition to the public type is deliberate.
