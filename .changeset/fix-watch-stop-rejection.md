---
"@verbatra/cli": patch
---

fix(cli): handle a rejected watcher stop so a failed shutdown exits cleanly

Both watch-session stop seams now catch a rejection from the underlying stop: the error is rendered to stderr and the session resolves exit code 2 instead of leaking an unhandled rejection that could crash the process. A clean stop still resolves 0 and a forced second stop still resolves 130.
