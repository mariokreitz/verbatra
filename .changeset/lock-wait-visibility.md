---
"@verbatra/sdk": patch
---

Make a contended write-lock wait visible instead of silent. When a locale's write lock is held by another run, or was left behind by a killed process, translate and watch now report that they are waiting, naming the lock file and, when it can be read, the holding process id and how long it has been held, so a blocked run no longer looks hung. A new `--lock-timeout` flag adjusts how long to wait before giving up. Lock acquisition is otherwise unchanged.
