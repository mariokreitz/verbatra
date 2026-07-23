---
"@verbatra/sdk": patch
---

Add support for the Java/Spring `.properties` format. Files with the `.properties`
extension are now detected and translated: keys are read flat (never split into a
tree), the standard escapes and `\uXXXX` are decoded on read, and output is written
canonically with `=` separators and ASCII-safe `\uXXXX` escapes for every non-ASCII
character, so it loads under a legacy `Properties.load`. Comments, blank lines, and
key order in an existing target file are preserved on write.

Placeholder integrity understands the java.text.MessageFormat argument syntax these
files are consumed through, including the typed and styled forms (`{0,number,integer}`,
`{0,date,short}`) and the sub-message forms (`{count,plural, ...}`), so a translation
that drops or alters an argument is caught. MessageFormat single-quote quoting is not
interpreted: a quoted literal such as `'{0}'` is still treated as an argument. This is
deliberate, so that an ordinary apostrophe in translated text never swallows a
following placeholder.
