---
"@verbatra/studio": patch
---

The Verbatra Studio dashboard has a completely redesigned interface: the dashboard now uses
Tailwind CSS, color-matched to the official documentation site's dark theme, in place of its
previous hand-written stylesheet. The layout is responsive, with a collapsible off-canvas
navigation drawer on narrower screens in place of the old fixed-width sidebar; the sidebar nav is
grouped (Project, Translations, Operations) with a breadcrumb trail and a search entry point above
it; and the UI is built on a full set of reusable components (Button, Card, form fields, Sheet,
Modal, Popover, Dropdown, Tabs, Accordion, Table, Toast, skeleton loaders) instead of duplicated
utility strings. Every panel (Overview, Status, Diff, Review, Usage, Lock, History) keeps its
existing behavior and read-only RPC surface unchanged; only the visual layout, typography, and
styling were rebuilt for a simpler, more consistent, and more accessible look.
