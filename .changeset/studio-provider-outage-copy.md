---
"@verbatra/studio": patch
---

Show specific copy when a provider-spending action fails because the provider itself is down.

The provider boundary now reports a server-side outage as `PROVIDER_UNAVAILABLE` rather than the
generic unclassified code. Studio's error table gains a matching entry, so retranslate and
translate-pending failures during an outage explain that the fault is on the provider's side and
the action is worth retrying later, instead of falling back to the generic server message.
