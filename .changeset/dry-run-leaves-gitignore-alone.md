---
"@verbatra/cli": patch
---

Leave `.gitignore` untouched on a dry run.

`translate` and `import` top up an existing `.gitignore` with the entries a project
scaffolded before `verbatra.cache.json` existed is missing. That top-up ran before the
dry-run branch, so `translate --dry-run` and `import --dry-run` appended to the file even
though `--dry-run` is documented as previewing "without writing files", and `import
--dry-run` did it even when the run then failed on an unreadable workbook.

Writing there is not harmless: `.gitignore` is tracked, so a preview dirtied the working
tree and could fail a CI job that asserts a clean checkout. The top-up now runs only on a
real run. `watch` is unaffected, having no dry-run mode.
