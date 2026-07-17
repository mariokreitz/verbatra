---
"@verbatra/sdk": minor
"@verbatra/studio": minor
---

Add a new sdk function, `keyIntegrity`, that reports per changed key
and target locale whether the format's placeholders or ICU structure
still match between source and target: a boolean match result plus,
on a mismatch, the specific placeholder tokens that are missing or
extra. It reuses core's `checkPlaceholders` and an adapter's own
`comparePlaceholders` exactly as they exist today; only "changed" keys
are checked, since a missing or orphaned key has no value on one side
to compare.

Studio exposes this through a new read-only RPC method, `key.integrity`,
scoped to exactly the one key currently open in the detail drawer,
mirroring the existing `history.list` pattern of supplementary data
fetched lazily on open rather than growing the already-uncapped
`status.diff` payload. `KeyDetailDrawer` now renders an Integrity
column with a pill: green for a match, red with the mismatched tokens
for a mismatch, and neutral (never a false red) for a format with no
placeholders at all. The pill reuses the existing `Badge` component
and its success, neutral, and danger tones; no new styling is added.

No RPC response carries a full source or target string value at any
point, only the boolean result and, on a mismatch, the specific
placeholder tokens involved.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the
same bump; its own behavior is unchanged.
