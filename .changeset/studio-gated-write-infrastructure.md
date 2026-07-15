---
"@verbatra/studio": minor
---

Add the first write-capable Studio action: an inline "Retranslate" button in the key detail
drawer, for a locale row whose key currently fails placeholder or ICU integrity. Off by default;
reachable only when the `verbatra studio` command is started with both `--allow-spend` and
`--allow-write` (or their environment variable equivalents). With either flag off, the action is
absent from the dashboard, not merely disabled, and the underlying RPC method is absent from the
server's own dispatch registry.

This is a deliberate, explicit relaxation of Studio's read-only-by-construction guarantee: the
server now optionally reaches a translation provider and writes to a project's locale files and
lock file, but only when an operator opts in at process start, never through any request the
dashboard itself can send.

`project.snapshot`'s result gains a read-only `capabilities` field (`{ spend, writeToDisk }`),
reflecting the same two resolved flags; the dashboard uses it only to hide the retranslate
affordance the server would refuse anyway, never as an authorization check.

Internally, the RPC handler registry is now built per server instance from its resolved
capabilities (`createRpcHandlers`) rather than a fixed module-level constant, and the write method
is gated by a dedicated, process-scoped rate limit at the dispatch layer.

`key.integrity`'s per-locale result gains a new `icuValid: boolean` field (a boolean only, never a
message string), and the key detail drawer's integrity pill gains a new danger state, "Invalid
message syntax", for a target value that is placeholder-valid but fails ICU message-syntax
validation, checked before the existing neutral "no placeholders" state. This is exactly the kind
of failure the new Retranslate action exists to fix, so it was already covered by
`canRetranslate`'s existing `tone === "danger"` gate once the pill itself learned to render it.
