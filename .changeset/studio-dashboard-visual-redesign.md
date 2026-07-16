---
"@verbatra/studio": minor
---

The Verbatra Studio dashboard is a completely redesigned application. The interface is rebuilt on
Tailwind CSS with a reusable design system (metric tiles, section cards, data tables with tinted
headers and progress meters, designed empty states, toasts, dialogs, tooltips, and skeleton
loaders) in place of the previous hand-written stylesheet. The shell is new: a collapsible icon
sidebar with grouped navigation, a fixed top bar with breadcrumbs, a global search entry point for
the command palette, and a System/Light/Dark theme switcher backed by a full light theme (the
dashboard was previously dark-only); the preference persists across reloads and "System" follows
live OS changes. Screens were recomposed rather than restyled: Overview leads with the project's
key facts and cards the configuration and glossary, Status and Lock lead with summary tiles over
coverage-metered tables, Usage renders token totals and the budget as tiles with a consumed meter,
Diff moves its report action into the page header and gains per-locale drift counts, Review gains
locale and key filters over the queue, and History renders as a commit feed. A new keyboard
shortcuts overview opens with "?" or from the top bar. Both themes were contrast-checked against
WCAG AA during development. Every panel keeps its existing behavior and read-only RPC surface
unchanged.
