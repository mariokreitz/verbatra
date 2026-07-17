---
"@verbatra/studio": minor
---

Commit history rows (in the Activity feed and in the commit history section of a key's detail
drawer) now show which locale files each commit touched, as a row of file chips under the
summary line. This data was already present in every response from the underlying commit-history
API; it just was not rendered before.
