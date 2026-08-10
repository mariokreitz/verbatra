---
"@verbatra/studio": patch
---

Bring the dashboard's React layer under the package's test and coverage gates.

`src/app`, the entire user-facing half of Studio, sat outside both the test-discovery and the
coverage globs. The package reported a healthy figure against the shared 90 percent gate while
every panel, overlay, primitive and hook contributed nothing to either side of the ratio, so the
number described the server and client halves only.

The React layer is now discovered and measured like the rest of the package: its components and
hooks are covered by co-located Vitest tests running against a real DOM, and the same unchanged 90
percent thresholds on lines, functions, statements and branches now apply to them. The few files
that stay unmeasured are named individually in the config with the reason each is excluded, so
nothing is invisible by omission rather than by decision.

No dashboard behavior changes. This is test and configuration work: the only new dependency is a
development-time DOM environment, and nothing new reaches the published bundle.
