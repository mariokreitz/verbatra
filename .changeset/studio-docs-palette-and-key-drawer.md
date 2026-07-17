---
"@verbatra/studio": minor
---

The Translations page's missing, changed, and orphaned key lists get their own distinct color
vocabulary, separate from the status badges, since "what changed" and "is this correct" are
different signals. When a project has nothing missing, changed, or orphaned in any locale, the
page shows a single designed all-clear state instead of a wall of empty per-locale sections.

Key and glossary translations render with right-to-left text direction for right-to-left locales
such as Arabic, Hebrew, Persian, and Urdu.

New: clicking a key opens a detail drawer showing that key's status per locale and the project's
commit history for its locale files. The drawer supports a focus trap, closing with Escape, and
returns focus to whatever was focused before it opened.
