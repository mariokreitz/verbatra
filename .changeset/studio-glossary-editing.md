---
"@verbatra/studio": minor
---

The Settings panel's glossary is editable when the project keeps its glossary in a JSON file. Terms
can be added, edited in place, and removed, and the panel shows the new state as soon as a
write lands, with no reload. A new `glossary.write` RPC method backs it, registered unconditionally
alongside the other local-editing methods, since changing a glossary calls no provider and spends
nothing; it is rate limited like every other write method and is exposed as an agent tool when
Studio was started with the agent-tools opt-in.

The server never accepts a file path: the target is derived from the loaded config alone. A glossary
written inline in the config, or no glossary at all, keeps the panel read-only and explains how to
move the terms into a JSON file, rather than rewriting the config module. `glossary.get` now reads a
file-backed glossary fresh on every call and names the terms whose values were redacted as
secret-shaped; the panel refuses to edit those, so a redaction placeholder can never be written back
over the real value.
