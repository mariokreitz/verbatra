---
"@verbatra/sdk": patch
---

Harden the XLIFF adapter's XML handling. Two trans-units resolving to the same key (typically a
duplicate `id`, or a positional fallback colliding with a real id) now raise `INVALID_STRUCTURE`
instead of silently dropping one entry on read and misdirecting a translation to both units on
write. The DTD and entity rejection already applied to XLIFF files on read now also applies to
translated values before they are re-parsed as XML fragments on write, closing a gap where a
malicious value could smuggle a DOCTYPE or entity declaration past the existing guard. Translated
values are also filtered against an allow-list of genuine XLIFF inline elements (`x`, `g`, `bx`,
`ex`, `ph`, `it`, `mrk`); a value containing any other element now degrades entirely to a plain
text node, the same fallback already used for unbalanced markup, instead of injecting an
unexpected live element into the written file.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own
behavior is unchanged.
