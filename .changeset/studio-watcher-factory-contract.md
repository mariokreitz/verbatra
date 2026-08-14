---
"@verbatra/studio": patch
---

`CreateStudioWatcher` now documents its real calling convention. It is called once per watched
entry, each call receiving a one-element array: one for the source locale file, one for each
configured target locale file, and one for the lock file. The earlier wording said it was called
once with every path, so an injected factory written to it built a single watcher and silently
observed the source file alone.
