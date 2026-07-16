---
"@verbatra/studio": patch
---

Let the final SSE shutdown frame flush before destroying connections on a graceful close. Destroying every socket in the same tick the frames were written discarded them before the loopback flushed, so a browser saw only a dropped connection and reconnected forever instead of showing the session-expired notice. A short grace period between the SSE hub's close and the connection teardown fixes the race; stopping the CLI now reliably lands the open dashboard on the session-expired screen. The redundant in-sync badge columns also leave the locale tables (the counts beside them already carry the same fact), and the reconnecting indicator waits out the normal connect handshake before appearing, so a fresh page load never flashes it.
