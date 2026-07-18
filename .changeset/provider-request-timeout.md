---
"@verbatra/sdk": patch
---

Bound every provider request with an abortable timeout so a hung-but-alive endpoint can no longer stall a run indefinitely. A stuck request previously held the per-locale write lock forever, blocking every later run for that locale. Requests now abort after a default of two minutes and surface a retriable timeout error, releasing the lock. Each provider accepts an optional `requestTimeoutMs` to tune the bound.
