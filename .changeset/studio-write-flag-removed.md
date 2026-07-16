---
"@verbatra/cli": minor
---

`verbatra studio` no longer takes the `--allow-write` flag (or its
`VERBATRA_STUDIO_ALLOW_WRITE` environment variable): Studio's local editing surface, the
needs-review queue's edit action, is now always available, still bound to the loopback session
and the same placeholder and ICU integrity gate as every write. `--allow-spend` is unchanged
and still gates every provider-calling action; passing the removed flag now fails with the
usual unknown-option error.
