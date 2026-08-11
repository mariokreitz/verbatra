---
"@verbatra/studio": minor
---

Support WebMCP agent-tool unregistration through an abort signal. `registerAgentTools` now accepts
an optional `signal` and passes it to every `registerTool` call, which is the only unregistration
mechanism the WebMCP specification offers. A signal that has already aborted registers nothing and
skips the snapshot call entirely, and an abort that lands mid-pass stops it where it stands. With no
signal supplied, the registered tool set is unchanged.
