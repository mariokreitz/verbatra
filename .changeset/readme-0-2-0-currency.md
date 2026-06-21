---
"@verbatra/cli": patch
"@verbatra/sdk": patch
---

Bring the published package READMEs up to the shipped 0.2.0 surface. The CLI README now lists all
five commands (adds `export` and `import`) with their documentation links and a note on the manual
-translation workflow. The SDK README documents all six exported functions (adds `exportWorkbook`
and `importWorkbook` with signatures) and the optional `glossary` and `tone` config fields. The
npm `homepage` now points at the documentation site. No runtime code changed.
