---
"@verbatra/studio": patch
---

Republish through the automated release pipeline so the package carries an npm provenance attestation, matching `@verbatra/sdk` and `@verbatra/cli`. The initial release was published manually to bootstrap npm's Trusted Publishing for a brand-new package, which cannot generate provenance outside a CI environment; no functional change.
