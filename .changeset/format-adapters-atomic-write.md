---
"@verbatra/format-adapters": patch
---

Make the target-file write atomic: the serialized content is written to a temp file in the same
directory as the target and then renamed over it, so a crash or interruption mid-write can no
longer leave a truncated/corrupt target file — a reader sees either the complete prior file or the
complete new file. Behavior-preserving otherwise: the serialized bytes are byte-identical across
all four adapters, a write failure still surfaces as the raw fs error (no new error type/code), and
temp cleanup is best-effort and never masks the original error. Parity with the SDK's lock-file
atomic write.
