---
"@verbatra/studio": minor
---

Studio's dashboard now matches the official docs site's color system: background, card, border,
and text tokens are ported from the docs site's dark theme, and its purple and lavender accent
carries over for links, the active nav item, and focus rings. The light theme gets a related,
readable variant of the same palette rather than being dropped.

Status pills (in sync, pending changes, drift, unavailable, and so on) now pair their color with a
glyph and a border accent, so the signal does not depend on distinguishing colors alone. The Diff
panel's missing, changed, and orphaned key lists get their own distinct color vocabulary, separate
from the status pills, since "what changed" and "is this correct" are different signals. When a
project has nothing missing, changed, or orphaned in any locale, the Diff panel now shows a single
designed success message instead of a wall of empty per-locale sections.

The Diff panel and the glossary table in the Config panel now set right-to-left text direction for
Arabic, Hebrew, Persian, and Urdu content.

New: clicking a key in the Diff panel opens a detail drawer showing that key's status per locale
and the project's commit history for its locale files. The drawer supports a focus trap, closing
with Escape, and returns focus to whatever was focused before it opened.
