---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix a top-level translation key named `__proto__` never getting a lock-file baseline. The lock
entries for a locale were accumulated on a plain object with `entries[key] = hash`, which for that
one key name hits the `Object.prototype` setter and is discarded rather than stored, and the
lock-file reader then dropped the key a second time because zod's record parser skips it. The key
was translated on the first run and, with no baseline to compare against, reported as unchanged
from then on, so a later edit to its source text was never picked up. Both the `translate` and the
workbook import path now build their lock entries through a `Map`, and the lock-file reader keeps
the key as an own property. Nothing is written to `Object.prototype` on either path.

Consumer impact: a project with a top-level `__proto__` key gets a lock entry for it on the next
run, and from then on an edit to that key's source text is reported as changed and retranslated,
which it should always have been. Nested keys such as `a.__proto__` were never affected.
