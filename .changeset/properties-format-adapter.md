---
"@verbatra/sdk": minor
---

Add support for the Java/Spring `.properties` format. Files with the `.properties`
extension are now detected and translated: keys are read flat (never split into a
tree), the standard escapes and `\uXXXX` are decoded on read, and output is written
canonically with `=` separators and ASCII-safe `\uXXXX` escapes for every non-ASCII
character, so it loads under a legacy `Properties.load`. Comments, blank lines, and
key order in an existing target file are preserved on write.
