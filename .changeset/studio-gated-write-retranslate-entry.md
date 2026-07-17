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

`@verbatra/cli`'s `studio` command gains one new flag, `--allow-spend`, with an environment
variable fallback (`VERBATRA_STUDIO_ALLOW_SPEND`); the CLI flag wins when both are given. It
defaults to off and is the only way to enable Studio's provider-calling actions, including the
new gated retranslate action. Local editing of the project's own locale files is always
available and needs no flag; only provider spend is gated.

`keyIntegrity`'s per-key result gains a new `icuValid: boolean` field, computed unconditionally
and independently of the placeholder check: a target value can now be reported as placeholder-valid
but ICU-invalid, the exact failure the gated retranslate action exists to fix. Always true for a
non-ICU format.

`translate()`/`watch()` and `importWorkbook()` now serialize their writes per target locale: each
locale's read-translate-write step, including the provider call, holds a new real, cross-process
advisory lock for that locale before touching its target file or lock-file entry, so a concurrent
writer for the same locale (another CLI run, a workbook import, or a Studio `retranslateEntry`
call) can never interleave with it and silently lose a key. A new `LOCK_CONTENDED` error code is
thrown if a locale's lock cannot be acquired within its timeout, naming the lock file's path. This
also removes the lock-file's previous compare-and-swap retry, which left a residual race window of
its own; mutual exclusion is now provided entirely by the new lock. A dry run never acquires a
lock, since it never writes anything.

Breaking change: the exported `SdkFs` interface gains two new required methods, `createExclusive`
and `deleteFile`, backing the new lock. Any custom `SdkFs` implementation passed to `translate()`,
`watch()`, `importWorkbook()`, or any other SDK entry point's `deps.fs` must add both, or it will
fail to type-check and, since the new lock is now taken unconditionally on every write path, throw
at runtime the first time a locale is written.
