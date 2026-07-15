---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add `retranslateEntry`, a new sdk seam that retranslates exactly one source key into exactly one
target locale: a single-entry provider call through the same `selectProvider` registry
`translate()` already uses, gated through a new shared `gateCandidateValue` accept/reject check
before anything reaches disk. On acceptance it writes the target locale file (merging only the
requested key, leaving every other key untouched) and updates the lock entry for that key; on
rejection it writes nothing and reports the candidate value and which check failed it. Add a new
`UNKNOWN_KEY` error code, thrown when the requested key does not exist in the source resource.

Also extract the placeholder and ICU integrity check that `translate()`/`watch()` and workbook
import already ran independently into this one shared `gateCandidateValue` function, and route
both existing call sites through it. This adds a real behavior change to `translate()`/`watch()`:
the provider-translation path previously only compared placeholders before accepting a
translation; it now also validates the candidate against the format's message syntax (ICU
plural/select, for `next-intl-json` and `arb`), so a well-formed-on-placeholders but malformed ICU
candidate is now withheld where it was previously accepted. This has no effect on non-ICU formats,
whose message validation always passes.

`@verbatra/cli`'s `studio` command gains two new flags, `--allow-spend` and `--allow-write`, each
with an environment variable fallback (`VERBATRA_STUDIO_ALLOW_SPEND`,
`VERBATRA_STUDIO_ALLOW_WRITE`); the CLI flag wins when both are given. Both default to off. These
flags are the only way to enable Studio's new gated retranslate action; with either flag off,
Studio remains exactly as read-only as before.
