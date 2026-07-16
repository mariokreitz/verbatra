---
"@verbatra/studio": minor
---

Verbatra Studio is a redesigned application, from the information architecture down. The seven
tabs are now four pages in two sidebar zones: Translations (the daily workspace: a status banner,
the key-by-locale explorer, and per-locale coverage with the lock file's state, merging the old
Status, Diff, and Lock tabs onto one page), Review (the flagged-entry queue with locale and key
filters), Activity (the commit feed beside the last run's token and budget figures, merging the
old Usage and History tabs), and Project (the resolved configuration and glossary, demoted from
a primary tab to a reference page). The current page lives in the URL hash, so a reload lands
back on the same page and browser back/forward work. The interface is rebuilt on Tailwind CSS
with a reusable design system and ships a full light theme beside the dark one: a System/Light/
Dark switcher persists the choice and follows live OS changes on System, and both themes were
contrast-checked against WCAG AA during development. The shell is a collapsible icon sidebar and
a fixed top bar with global search, a keyboard-shortcuts overview (also on "?"), and the theme
switcher; the command palette now jumps across the four pages and still jumps to any pending
key. Every read-only RPC behavior, capability gate, and data state is unchanged.
