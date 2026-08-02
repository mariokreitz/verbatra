---
"@verbatra/sdk": patch
---

Preserve a `.properties` file's line endings when writing it.

The `.properties` parser accepts all three physical terminators (`\n`, `\r\n`,
`\r`), but the serializer always joined with `\n` regardless of what the
destination used. `.properties` is the Java and Spring format, so these files
commonly live in CRLF repositories, where the first `verbatra translate`
rewrote every line and turned a two-key translation change into a whole-file
diff.

The write now follows the destination: a file containing any CRLF is written
back entirely with CRLF, a CR-only file with CR, and everything else, including
a destination that does not exist yet, with LF. Comment, blank-line and
key-order preservation are unchanged, and a value's own `\r` or `\n` is still
escaped rather than emitted as a terminator.
