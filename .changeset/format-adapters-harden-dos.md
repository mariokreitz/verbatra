---
"@verbatra/format-adapters": patch
---

Harden the i18next read path against hostile files (Security NO-GO fixes): placeholder
extraction is now linear (was quadratic on unbalanced `{{`), and read enforces a maximum
nesting depth and input size, surfacing over-limit or otherwise failing input as a structured
AdapterError (new codes MAX_DEPTH_EXCEEDED and INPUT_TOO_LARGE) instead of an uncaught
RangeError. Error messages no longer echo file key paths. No public API signature changes;
behavior is unchanged for well-formed files.
