---
"@verbatra/studio": minor
---

The Diff panel gets a new grid view: rows are keys, columns are target locales, and each cell
shows that key's status (missing, changed, orphaned, or in sync) with the same color and badge
vocabulary as the rest of the dashboard. Each locale column header shows its completeness
percentage. Grid is the default view; the previous flat per-locale key lists stay reachable as a
"List" view through a toggle above the table.

The grid supports keyboard-first navigation: arrow keys move between cells and wrap at the grid's
edges, Enter or Space opens the key detail drawer for the focused row's key, and Escape closes it.
Only the currently focused cell is in the Tab order, so tabbing into the grid and back out stays a
single stop either way.
