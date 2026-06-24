---
"@verbatra/format-adapters": minor
---

feat(format-adapters): round-trip literal dotted leaf keys losslessly

A JSON locale key that contains a literal dot used as a single leaf (for example
`{"foo.bar": "Hi"}`) is now read, translated, and written back as one literal leaf instead of
being silently re-nested into `{"foo": {"bar": "Hi"}}`. Real nested paths still stay nested, and a
file mixing both round-trips with each member's shape preserved. The fix lives once in the shared
JSON layer (a per-segment backslash escape in `flatten`/`unflatten`), so all four JSON adapters
benefit; ngx-translate keeps its flat-vs-nested path-notation behavior unchanged.

A genuinely ambiguous file (a literal dotted leaf and a real nested path resolving to the same
effective path, for example `{"foo.bar": "Hi", "foo": {"bar": "Hello"}}`) still fails loudly with a
structured `AdapterError` (`INVALID_STRUCTURE`); it is never silently picked or corrupted.

Compatibility: the change is observable only for keys that actually contain a literal dot. Projects
with no literal dotted leaf keys are unaffected: write output is byte-for-byte identical, lock-file
keys and content hashes are unchanged, and a re-run performs no re-translation. There is no
lock-file version bump. Projects that already used literal dotted leaf keys may see a one-time
re-translation limited to those dotted keys (their on-disk shape was previously rewritten as
nested); non-dotted keys in the same project are unaffected.
