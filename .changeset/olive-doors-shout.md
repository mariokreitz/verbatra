---
"@verbatra/studio": patch
---

Report failed agent tool registrations instead of silently dropping them. The WebMCP surface
answers `registerTool` with a promise, whose result the dashboard discarded, so a rejected
registration escaped as an unhandled rejection and a failing tool simply appeared to do nothing.
Each registration is now awaited and caught individually: one refused tool no longer stops the
tools after it, the outcome is written to the browser console naming every failing tool with its
error name, and the dashboard shows a `role="alert"` degraded-mode notice. A run in which every
registration succeeds stays entirely silent.
