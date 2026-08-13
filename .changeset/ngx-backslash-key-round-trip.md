---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix the `ngx-translate-json` adapter corrupting a key that contains a backslash. Reading a nested
file built the dotted path from the raw object keys, while writing decoded that path with
backslashes treated as escape characters. The two halves disagreed, so `{"a":{"b\\c":"hello"}}` was
written back as `{"a":{"bc":"hello"}}`: the value moved to a key the app never asks for, the real
key looked untranslated on every later run and was paid for again, and the mangled key piled up as
an orphan. Backslashes in a key segment are now escaped when the path is built, symmetrically with
the decoding the write path already did, and the flat-file writer decodes the path back so a flat
file still round-trips byte for byte. Only `ngx-translate-json` uses path-notation keys; the
i18next, next-intl, and vue-i18n adapters were never affected.

Consumer impact, for an ngx-translate project that has a backslash in a key: that key's spelling
changes, from `a.b\c` to `a.b\\c`, everywhere verbatra names it (the lock-file, an exported
workbook, CLI output). The old lock entry no longer matches and is dropped on the next write. What
happens next depends on the file the key lives in. If the target file still holds the value under
the right key (flat files always did, since they were written verbatim), the key is adopted as up
to date: no provider call, no cost, and a fresh baseline is recorded. If the target was already
corrupted by an earlier version, the correct key is genuinely missing and is translated once, and
the mangled key is reported as orphaned; remove it, or run with `--prune`. Keys without a backslash
are unaffected.
