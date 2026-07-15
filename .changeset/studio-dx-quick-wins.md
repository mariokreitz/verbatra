---
"@verbatra/studio": minor
---

Three small, additive dashboard usability improvements.

A keyboard-invoked (Cmd+K on Mac, Ctrl+K elsewhere) command palette lists every jump target: the
five app tabs, plus, once the Diff panel has loaded data in the current session, every pending
key/locale combination, filterable by typing. Every entry is pure navigation (no write, network,
or provider call is reachable from it); selecting a tab switches to it, and selecting a key/locale
entry switches to the Diff tab and opens that key's detail drawer, the same as a manual click.

The Diff panel gets a "Copy as review report" button that renders the full, currently loaded diff
data (never the on-screen filtered or capped view) as a Markdown summary, per locale, the missing,
changed, and orphaned key counts and key names, and copies it to the clipboard, with a brief
"Copied" confirmation.

RPC errors now render specific, actionable copy for known error codes (transport-level errors, sdk
errors reachable through the read-only check, diff, and lock endpoints, and adapter parse errors on
a target locale file), falling back to the existing generic message for any other code. Nothing
about how errors are produced, redacted, or transported changes; this is a client-rendering
improvement only.
