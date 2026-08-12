---
"@verbatra/studio": patch
---

Make the Studio theme initializer idempotent. It now detaches the OS scheme listener a
previous call registered before attaching a new one, so repeated calls leave at most one
active listener instead of accumulating one per call.
