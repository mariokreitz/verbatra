---
"@verbatra/studio": patch
---

Publish exactly one lock refresh for one atomic lock-file write. An atomic write (temp sibling, then rename over the target) reaches chokidar as an "add" followed by a "change" on the same path, released on chokidar's own 50ms per-path change throttle. Both map onto the studio watcher's single listener, so once that gap exceeded the debounce window the trailing timer fired twice and one logical write published two refresh events, costing consumers a redundant refetch. The lock entry now compares the watched file's identity (inode, size, and modification time) at settle time and drops a refresh that reports the same file state as the one it last published. The check fails open: an identity that cannot be read is never treated as a duplicate.
