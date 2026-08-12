---
"@verbatra/studio": patch
---

Mark the status grid's coverage as last known when a re-read fails. The locale
headers previously rendered stale percentages exactly like freshly fetched ones,
so a failed background refresh left outdated coverage looking current. The
percentages now stay on screen under the same stale notice the activity, review,
and translations panels already render.
