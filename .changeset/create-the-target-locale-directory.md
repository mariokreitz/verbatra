---
"@verbatra/sdk": patch
---

Create a locale file's directory instead of failing when it does not exist.

Adding a target locale failed outright for any project whose `files.pattern` puts the locale in a
directory rather than the filename. `locales/{locale}/common.json`, the standard layout for i18next
namespaces, is the common case: the first run for a new locale has nowhere to write, so the write
threw.

The failure was also hard to act on. It surfaced as a raw `ENOENT` naming the hidden temporary file
the atomic write uses, not the path configured in `files.pattern`, so the error pointed at a file
that had never been asked for and no longer existed by the time anyone looked.

The write path now creates the containing directory first, which is what the SDK already did for
its own artifacts (the lock file, the cache, the run-status snapshot and the workbook). It applies
to every format, since they all write through the same path, and it is a no-op for the flat
`locales/{locale}.json` layout where the directory is already there.
