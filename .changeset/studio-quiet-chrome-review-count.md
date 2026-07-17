---
"@verbatra/studio": minor
---

Quiet the chrome and surface the review queue in the navigation. The header's permanent Live badge and the Settings session card are gone: a page being served at all implies a live local process, so connection state only appears while the stream is actually degraded, and the one startup fact worth keeping (whether provider actions were enabled) moves into the Configuration card. The Review nav entry now carries a live count of entries waiting for review, updated instantly by approve, reject, and accepted-edit actions.
