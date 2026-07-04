---
"@verbatra/sdk": patch
---

Fix the ARB adapter silently erasing all `@`-prefixed metadata (`@@locale`, and every `@key` description and placeholder block) when the destination file existed but could not be parsed. A destination write used to treat "file missing" (a legitimate first write) and "file present but corrupt, too large, or the wrong shape" identically, discarding metadata in both cases with no error. A missing destination still writes messages only, as before. A destination that exists but is not a usable ARB object now throws a structured error instead of silently proceeding, so a merge-conflicted or half-edited ARB file is surfaced as an error rather than causing silent metadata loss on the next translate run. The change lives in the private `@verbatra/format-adapters` package, so the observable behavior surfaces through `@verbatra/sdk` (and `@verbatra/cli`, version-locked).
