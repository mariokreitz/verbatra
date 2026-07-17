---
"@verbatra/studio": minor
---

Verbatra Studio is a redesigned application, from the information architecture down. It is
organized as four pages in two sidebar zones: Translations (the daily workspace: a status banner
with the last run's token figures, the key-by-locale explorer, and per-locale coverage with the
lock file's state), Review (the flagged-entry queue with locale and key filters), Activity (the
commit feed beside the last run's token and budget breakdown), and Settings (the session's
capabilities plus the resolved configuration and glossary). The current page lives in the URL
hash, so a reload lands back on the same page and browser back/forward work.

The dashboard is now fully live: every page re-fetches on the file-watcher's refresh signal
(coverage, the key diff, the lock state, the review queue, usage, and history), and the top bar
carries a live indicator that turns amber while the stream reconnects. The key detail drawer is
richer, showing the key's current source value and each locale's current translation alongside
status and integrity, all updating live.

Local editing needs no flag: the needs-review queue's edit, approve, and reject actions are
available from the start, behind the loopback session and the same placeholder and ICU
integrity gate as every write. Provider-calling actions (retranslate, translate pending) are
opt-in via --allow-spend.

The interface is rebuilt on Tailwind CSS with a reusable design system and a restrained, minimal
look: overhauled dot-style badges, neutral elevation, and no page transitions. It ships a full
light theme beside the dark one (System/Light/Dark switcher, persisted, following live OS
changes on System), both contrast-checked against WCAG AA during development. Navigation is the
flat four-page sidebar; every page is reachable in one click.
