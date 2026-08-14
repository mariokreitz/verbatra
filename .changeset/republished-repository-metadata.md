---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Republish with no code changes. The published package metadata (`repository.url`
and `bugs.url`) now points at github.com/verbatra/verbatra, the repository's
current location after the move to the verbatra organization. The previous
release was published shortly before that rewrite landed, so its metadata still
referenced the old path.
