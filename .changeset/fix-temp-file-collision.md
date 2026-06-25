---
"@verbatra/format-adapters": patch
"@verbatra/sdk": patch
---

fix: make atomic-write temp-file names collision-proof

Both atomic-write paths (the SDK file seam and the format-adapters JSON writer) now append a random UUID to the temp-file name, so two writes to the same target in the same millisecond from the same process can never collide on the temp name. The atomic same-directory-temp-then-rename behavior is otherwise unchanged.
