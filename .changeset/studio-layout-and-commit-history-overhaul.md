---
"@verbatra/studio": minor
---

Studio's dashboard content area no longer caps at a flat 960px regardless of window size; tables
and detail lists size to their own content instead of stretching to fill the panel, so a wide
window no longer produces sparse, oversized columns.

The History panel (and the commit history section in a key's detail drawer) now shows which locale
files each commit touched, as a row of file chips under its summary line. This data was already
present in every response from the underlying commit-history API; it just was not rendered before.

The Overview and Config tabs are merged into one Overview tab. Config's fields (file pattern,
prune, generate-plurals, max batch size, tone, and the full glossary table) were a strict superset
of Overview's, so the two tabs showed almost the same information behind separate clicks; the
Config tab no longer exists.
