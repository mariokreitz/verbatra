---
"@verbatra/sdk": patch
---

Report progress during translate and watch. `translate()` and `watch()` now accept an optional `onProgress` listener that fires as a run advances: once per locale before it starts and after it finishes, once per provider sub-batch within a locale, and once when the whole run ends. As with the existing lock-wait signal, the SDK writes nothing itself; the CLI renders these events to stderr in both human and `--json` mode, so stdout stays a clean summary or NDJSON stream. A dry-run makes no provider call and so emits no sub-batch events.
