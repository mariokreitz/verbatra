---
"@verbatra/sdk": patch
---

Disclose four bundled runtime dependency moves that shipped undisclosed in 0.6.3.

These versions changed in `@verbatra/sdk`'s published `dependencies` between 0.6.2 and 0.6.3
without a changeset or a changelog entry. They are real dependencies of the published tarball,
not internals, so each one lands in a consumer's `node_modules`, lockfile, `npm audit` output
and SBOM. This entry is the retroactive record; no version moves as part of it.

- `openai` 6.46.0 to 7.3.0
- `@anthropic-ai/sdk` 0.111.0 to 0.115.0
- `@google/genai` 2.11.0 to 2.15.0
- `@formatjs/icu-messageformat-parser` 3.5.11 to 3.5.16

`openai` is the only major. Its sole breaking change is a new `engines.node` floor of `>=22.0.0`,
which every published verbatra package already subsumes by declaring `>=22.14.0`, so no consumer
meeting verbatra's own floor is affected. The provider seam was verified against the new major
rather than assumed compatible: the emitted error modules are byte-identical between the two
versions, which is the check that matters because provider error classification matches on the
runtime constructor name, and the `ChatModel` union is unchanged, so the published declarations
do not shift either. `@anthropic-ai/sdk` was checked to the same depth. `@google/genai` and
`@formatjs/icu-messageformat-parser` are recorded as version moves only, with no compatibility
claim beyond a green build and test suite.

Nothing is being rolled back. CI now fails any pull request that changes what a published package
makes consumers install without a changeset, so this class of silent move cannot recur.
