---
"@verbatra/sdk": patch
---

Keep `verbatra.cache.json` gitignored in projects scaffolded before it existed.

The ignore entry was only ever written by `verbatra init`, so a project
initialized on an earlier release never received it. Every write path creates
the cache at the project root, so upgrading users got a new untracked file next
to their locale changes and were liable to commit it, contradicting the cache's
own documented contract that it is local, gitignored and never committed.
`.verbatra-local/` is the same defect one release earlier.

`translate`, `watch` and `import` now top up an existing `.gitignore` with any
entry it is missing, once per invocation. The check is deliberately narrow: it
never creates a `.gitignore` that does not exist, it is silent so `--json`
stdout is untouched, it never fails a run, and it decides purely on file
presence and content, with no `git` subprocess and no new dependency. Re-running
`verbatra init` still produces no duplicate entry. The cache file does not move.

If you already committed `verbatra.cache.json`, no `.gitignore` change untracks
it; run `git rm --cached verbatra.cache.json` once. On the current release you
can also get the entry today, without upgrading, by re-running
`verbatra init --provider <id> --yes`, which is non-destructive because it skips
every file that already exists.
