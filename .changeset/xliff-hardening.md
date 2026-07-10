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
`ex`, `ph`, `it`, `mrk`), each carrying no namespace or the genuine XLIFF 1.2/2.0 document
namespace, and each restricted to its own minimal, non-executable set of attributes (`id`, and
where applicable `rid`, `ctype`, `pos`, or `mtype`). A value containing any other element, an
allow-listed element under any other namespace, a CDATA section, a comment, a processing
instruction, or an attribute outside that element's allow-list (such as `onclick` or
`xlink:href`) now degrades entirely to a plain text node, the same fallback already used for
unbalanced markup, instead of reaching the written file as live markup or an unfiltered attribute.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own
behavior is unchanged.
