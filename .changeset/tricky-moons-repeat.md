---
"@verbatra/studio": patch
---

Handle the new `empty` integrity rejection in the editor.

The SDK now refuses an empty or whitespace-only translation of a non-empty
source. Studio's edit dialog is a plain text area and a Save button, so
select-all-delete previously wrote the empty value straight through; it is now
rejected with "Rejected: empty translation" and nothing is written.

The status label is deliberately context-free, because the same map renders
retranslate outcomes, where an empty value came from the provider and the user
typed nothing. The edit dialog additionally shows a local hint pointing at the
export, `[[CLEAR]]`, import round trip, which remains the supported way to
unset a translation.
